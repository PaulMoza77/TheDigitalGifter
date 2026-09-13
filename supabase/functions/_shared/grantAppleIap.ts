/**
 * Admin-authoritative Apple IAP credit grant.
 * Credits always come from pricing_items (via PricingCreditPack), never the client.
 *
 * Prefer the Admin-aware Postgres RPC when it succeeds. Fall back to an
 * Admin-aware direct grant (idempotent apple_iap_transactions + credits_ledger)
 * when the live RPC still lags on a hardcoded product map or otherwise fails.
 *
 * After any successful RPC (including already_processed), we still call
 * ensureLedgerRow so a prior partial write (tx without ledger) still credits.
 */

import type { PricingCreditPack } from "./iapProducts.ts";

type ServiceClient = {
  from: (table: string) => any;
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
};

export type AppleGrantInput = {
  userId: string;
  userEmail: string;
  transactionId: string;
  originalTransactionId: string | null;
  productId: string;
  environment: "Sandbox" | "Production";
  purchaseDate: Date | null;
  bundleId: string;
  appAccountToken: string;
  pack: PricingCreditPack;
};

export type AppleGrantResult = {
  status: "granted" | "already_processed";
  credits_granted: number;
  product_id: string;
  transaction_id: string;
  pack_key: string;
  path: "rpc" | "direct";
};

function isHardcodedRpcLag(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("credit amount mismatch") ||
    m.includes("unknown product")
  );
}

function ledgerNote(transactionId: string): string {
  return `apple_iap:${transactionId}`;
}

/** Ensure credits_ledger has the apple_iap:<tx> row for this grant. */
async function ensureLedgerRow(
  service: ServiceClient,
  input: AppleGrantInput,
  opts: { alreadyHadTx: boolean; path: "rpc" | "direct"; statusHint?: "granted" | "already_processed" }
): Promise<AppleGrantResult> {
  const note = ledgerNote(input.transactionId);
  const credits = input.pack.credits;

  const { data: existingLedger, error: ledgerLookupError } = await service
    .from("credits_ledger")
    .select("id,user_id,credits,direction")
    .eq("note", note)
    .maybeSingle();
  if (ledgerLookupError) throw ledgerLookupError;

  if (existingLedger) {
    const ok =
      String(existingLedger.user_id) === input.userId &&
      String(existingLedger.direction) === "in" &&
      Number(existingLedger.credits) === credits;
    if (!ok) throw new Error("ledger_replay_mismatch");
    return {
      status: "already_processed",
      credits_granted: credits,
      product_id: input.productId,
      transaction_id: input.transactionId,
      pack_key: input.pack.packKey,
      path: opts.path,
    };
  }

  const { error: ledgerError } = await service.from("credits_ledger").insert({
    user_convex_id: input.userEmail,
    user_id: input.userId,
    direction: "in",
    credits,
    event_type: "apple_iap",
    category: "apple_iap",
    note,
    template_title: input.pack.packKey || input.productId,
  });

  if (ledgerError) {
    if (
      String(ledgerError.code || "") === "23505" ||
      /duplicate/i.test(ledgerError.message || "")
    ) {
      return {
        status: "already_processed",
        credits_granted: credits,
        product_id: input.productId,
        transaction_id: input.transactionId,
        pack_key: input.pack.packKey,
        path: opts.path,
      };
    }
    throw ledgerError;
  }

  const status =
    opts.statusHint ??
    (opts.alreadyHadTx ? "already_processed" : "granted");

  return {
    status,
    credits_granted: credits,
    product_id: input.productId,
    transaction_id: input.transactionId,
    pack_key: input.pack.packKey,
    path: opts.path,
  };
}

async function grantViaRpc(
  service: ServiceClient,
  input: AppleGrantInput
): Promise<AppleGrantResult | { error: string }> {
  const { data, error } = await service.rpc("grant_apple_iap_credits", {
    p_user_id: input.userId,
    p_user_email: input.userEmail,
    p_transaction_id: input.transactionId,
    p_original_transaction_id: input.originalTransactionId,
    p_product_id: input.productId,
    p_environment: input.environment,
    p_purchase_date: input.purchaseDate?.toISOString() ?? null,
    p_bundle_id: input.bundleId,
    p_app_account_token: input.appAccountToken,
    p_credits: input.pack.credits,
  });

  if (error) return { error: error.message || "grant_rpc_failed" };

  const row = (data || {}) as Record<string, unknown>;
  const statusRaw = String(row.status || "granted");
  const status =
    statusRaw === "already_processed" ? "already_processed" : "granted";
  const creditsGranted = Number(row.credits_granted ?? input.pack.credits);

  // Guard: never accept an RPC grant that disagrees with Admin pack credits.
  if (creditsGranted !== input.pack.credits) {
    return {
      error: `credit amount mismatch: rpc=${creditsGranted} admin=${input.pack.credits}`,
    };
  }

  // Heal ledger even when RPC returns already_processed (partial prior write).
  try {
    const healed = await ensureLedgerRow(service, input, {
      alreadyHadTx: status === "already_processed",
      path: "rpc",
      statusHint: status,
    });
    return healed;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `rpc_ok_ledger_heal_failed:${message}` };
  }
}

async function grantViaDirectAdminWrite(
  service: ServiceClient,
  input: AppleGrantInput
): Promise<AppleGrantResult> {
  const credits = input.pack.credits;

  const { data: existing, error: existingError } = await service
    .from("apple_iap_transactions")
    .select(
      "transaction_id,user_id,product_id,bundle_id,credits_granted,app_account_token,granted_at,status"
    )
    .eq("transaction_id", input.transactionId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const sameOwner =
      String(existing.user_id) === input.userId &&
      String(existing.product_id) === input.productId &&
      String(existing.bundle_id) === input.bundleId &&
      Number(existing.credits_granted) === credits &&
      String(existing.app_account_token || "").toLowerCase() ===
        input.appAccountToken.toLowerCase();
    if (!sameOwner) {
      throw new Error("transaction_replay_mismatch");
    }
    return await ensureLedgerRow(service, input, {
      alreadyHadTx: true,
      path: "direct",
    });
  }

  const { error: txError } = await service.from("apple_iap_transactions").insert({
    user_id: input.userId,
    user_email: input.userEmail,
    transaction_id: input.transactionId,
    original_transaction_id: input.originalTransactionId,
    product_id: input.productId,
    environment: input.environment,
    purchase_date: input.purchaseDate?.toISOString() ?? null,
    bundle_id: input.bundleId,
    app_account_token: input.appAccountToken.toLowerCase(),
    credits_granted: credits,
    status: "granted",
    granted_at: new Date().toISOString(),
  });

  if (txError) {
    if (
      String(txError.code || "") === "23505" ||
      /duplicate/i.test(txError.message || "")
    ) {
      const { data: raced } = await service
        .from("apple_iap_transactions")
        .select(
          "transaction_id,user_id,product_id,bundle_id,credits_granted,app_account_token"
        )
        .eq("transaction_id", input.transactionId)
        .maybeSingle();
      if (raced && String(raced.user_id) === input.userId) {
        const sameOwner =
          String(raced.product_id) === input.productId &&
          Number(raced.credits_granted) === credits;
        if (!sameOwner) throw new Error("transaction_replay_mismatch");
        return await ensureLedgerRow(service, input, {
          alreadyHadTx: true,
          path: "direct",
        });
      }
    }
    throw txError;
  }

  return await ensureLedgerRow(service, input, {
    alreadyHadTx: false,
    path: "direct",
  });
}

/**
 * Grant credits for a verified Apple transaction using Admin pack credits.
 *
 * Prefer the Admin-aware RPC when available (atomic). Direct write remains the
 * fallback path and works even if the RPC still lags.
 * Set IAP_PREFER_RPC_GRANT=0 to force direct-only.
 */
export async function grantAppleIapCredits(
  service: ServiceClient,
  input: AppleGrantInput
): Promise<AppleGrantResult> {
  const forceDirect = String(Deno.env.get("IAP_PREFER_RPC_GRANT") || "")
    .trim()
    .toLowerCase();
  const skipRpc =
    forceDirect === "0" || forceDirect === "false" || forceDirect === "no";

  if (!skipRpc) {
    const rpcResult = await grantViaRpc(service, input);
    if (!("error" in rpcResult)) return rpcResult;
    console.warn(
      "[grantAppleIap] rpc unavailable; using direct Admin grant:",
      rpcResult.error,
      isHardcodedRpcLag(rpcResult.error) ? "(hardcoded-lag)" : ""
    );
    try {
      return await grantViaDirectAdminWrite(service, input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`grant_failed:${rpcResult.error}|direct:${message}`);
    }
  }

  try {
    return await grantViaDirectAdminWrite(service, input);
  } catch (directErr) {
    const directMessage =
      directErr instanceof Error ? directErr.message : String(directErr);
    const rpcResult = await grantViaRpc(service, input);
    if (!("error" in rpcResult)) {
      console.warn(
        "[grantAppleIap] direct failed; rpc succeeded:",
        directMessage
      );
      return rpcResult;
    }
    throw new Error(
      `grant_failed:direct:${directMessage}|rpc:${rpcResult.error}`
    );
  }
}
