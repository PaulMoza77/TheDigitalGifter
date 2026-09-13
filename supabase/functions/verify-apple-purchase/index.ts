import { optionsResponse, jsonResponse } from "../_shared/cors.ts";
import { getAuthUser, getServiceClient, readJson } from "../_shared/supabase.ts";
import {
  APPLE_BUNDLE_ID,
  lookupCreditPackByAppleProductId,
} from "../_shared/iapProducts.ts";
import { grantAppleIapCredits } from "../_shared/grantAppleIap.ts";
import {
  allowXcodeIapGrants,
  fetchAppleTransactionViaApi,
  grantEnvironment,
  verifyAppleTransactionJws,
} from "../_shared/appleVerify.ts";

const MAX_VERIFY_PER_HOUR = 40;

type VerifyBody = {
  /** StoreKit 2 signed transaction JWS (expo-iap purchaseToken on iOS). */
  signedTransaction?: string;
  transactionJws?: string;
  purchaseToken?: string;
  /** Optional client hint — never trusted for credits or environment. */
  productId?: string;
};

function clientError(code: string, status = 400) {
  const messages: Record<string, string> = {
    unauthorized: "Sign in to purchase credits.",
    invalid_payload: "Purchase could not be verified. Please try again.",
    unknown_product: "This product isn't available.",
    verification_failed: "Purchase could not be verified. Please try again.",
    rate_limited: "Too many attempts. Please wait and try again.",
    grant_failed: "Purchase verified but credits could not be added yet. We'll retry.",
    account_mismatch: "Purchase could not be linked to this account.",
  };
  return jsonResponse(
    { error: messages[code] || messages.verification_failed, code },
    status
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await getAuthUser(req);
    if (!user?.id) return clientError("unauthorized", 401);

    const body = await readJson<VerifyBody>(req);
    const jws = String(
      body.signedTransaction || body.transactionJws || body.purchaseToken || ""
    ).trim();
    if (!jws) return clientError("invalid_payload");

    const service = getServiceClient();
    const expectedBundle =
      Deno.env.get("APPLE_BUNDLE_ID")?.trim() || APPLE_BUNDLE_ID;

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await service
      .from("apple_iap_verify_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_VERIFY_PER_HOUR) {
      return clientError("rate_limited", 429);
    }

    let verified;
    try {
      const submitted = await verifyAppleTransactionJws(jws, expectedBundle);

      if (submitted.environment === "Xcode") {
        // StoreKit Testing in Xcode is not in App Store Server API.
        // Opt-in only — never treat client JWS as authoritative for Sandbox/Production.
        if (!allowXcodeIapGrants()) {
          throw new Error("xcode_grants_disabled");
        }
        verified = submitted;
      } else {
        // Mandatory authoritative check for device / TestFlight / App Store.
        const apiTx = await fetchAppleTransactionViaApi(
          submitted.transactionId,
          submitted.environment
        );
        if (apiTx.transactionId !== submitted.transactionId) {
          throw new Error("api_transaction_mismatch");
        }
        if (apiTx.productId !== submitted.productId) {
          throw new Error("api_product_mismatch");
        }
        if (apiTx.bundleId !== expectedBundle) {
          throw new Error("api_bundle_mismatch");
        }
        verified = apiTx;
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : "verify_error";
      await service.from("apple_iap_verify_attempts").insert({
        user_id: user.id,
        product_id: body.productId ?? null,
        outcome: `fail:${reason}`.slice(0, 120),
      });
      console.warn("[verify-apple-purchase] verification_failed", reason);
      return clientError("verification_failed", 403);
    }

    if (String(verified.type || "").trim().toLowerCase() !== "consumable") {
      await service.from("apple_iap_verify_attempts").insert({
        user_id: user.id,
        product_id: verified.productId,
        outcome: "fail:not_consumable",
      });
      return clientError("verification_failed", 403);
    }

    const pack = await lookupCreditPackByAppleProductId(
      service,
      verified.productId
    );
    if (!pack) {
      await service.from("apple_iap_verify_attempts").insert({
        user_id: user.id,
        product_id: verified.productId,
        outcome: "fail:unknown_product",
      });
      return clientError("unknown_product", 403);
    }

    if (
      !verified.appAccountToken ||
      verified.appAccountToken.toLowerCase() !== String(user.id).toLowerCase()
    ) {
      await service.from("apple_iap_verify_attempts").insert({
        user_id: user.id,
        product_id: verified.productId,
        outcome: "fail:account_mismatch",
      });
      return clientError("account_mismatch", 403);
    }

    const email = String(user.email || "").trim().toLowerCase();
    if (!email) {
      return clientError("unauthorized", 401);
    }

    let grant;
    try {
      grant = await grantAppleIapCredits(service, {
        userId: user.id,
        userEmail: email,
        transactionId: verified.transactionId,
        originalTransactionId: verified.originalTransactionId,
        productId: pack.productId,
        environment: grantEnvironment(verified.environment),
        purchaseDate: verified.purchaseDate,
        bundleId: verified.bundleId,
        appAccountToken: verified.appAccountToken,
        pack,
      });
    } catch (err) {
      await service.from("apple_iap_verify_attempts").insert({
        user_id: user.id,
        product_id: pack.productId,
        outcome: "fail:grant",
      });
      console.warn(
        "[verify-apple-purchase] grant_failed",
        err instanceof Error ? err.message : String(err)
      );
      return clientError("grant_failed", 500);
    }

    await service.from("apple_iap_verify_attempts").insert({
      user_id: user.id,
      product_id: pack.productId,
      outcome: `${grant.status}:${grant.path}`,
    });

    return jsonResponse({
      ok: true,
      status: grant.status,
      credits_granted: grant.credits_granted,
      product_id: grant.product_id,
      pack_key: grant.pack_key,
      transaction_id: grant.transaction_id,
      environment: verified.environment,
      grant_path: grant.path,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "error";
    console.warn("[verify-apple-purchase] unexpected", message);
    return clientError("verification_failed", 500);
  }
});
