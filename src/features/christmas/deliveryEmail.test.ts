import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { recoveryRouteForOrder as denoRecoveryRouteForOrder } from "../../../supabase/functions/_shared/christmas/portraitPromptRegistry.ts";
import {
  buildDeliveryRecoveryUrl,
  buildPhotoSantaDeliveryContent,
  deliveryEmailHasMarketingCopy,
  deliveryKindForProduct,
  PHOTO_SANTA_RESEND_ENDPOINT,
  planPhotoSantaDeliveryEmail,
  recoveryRouteForOrder,
  sendPhotoSantaDeliveryEmail,
} from "./deliveryEmail";

function readSrc(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const configured = {
  email: "buyer@example.com",
  tokenHint: "tok_photo_abc",
  productKey: "christmas_photo",
  sourceRoute: "/christmas/photo-generator",
  siteOrigin: "https://www.thedigitalgifter.com",
  resendApiKey: "re_test_key",
  fromAddress: "The Digital Gifter <hello@thedigitalgifter.com>",
};

describe("photo/santa V1 recovery route", () => {
  it("prefers source_route over product/species fallbacks", () => {
    expect(
      recoveryRouteForOrder({
        productKey: "christmas_pet",
        species: "cat",
        sourceRoute: "/christmas/dogs",
        landingPath: "/christmas/cats",
      }),
    ).toBe("/christmas/dogs");
    expect(
      recoveryRouteForOrder({
        productKey: "christmas_santa_video",
        sourceRoute: "/christmas/santa-video",
      }),
    ).toBe("/christmas/santa-video");
  });

  it("strips query from source_route and stays on christmas verticals", () => {
    expect(
      recoveryRouteForOrder({
        productKey: "christmas_photo",
        sourceRoute: "/christmas/family?utm=x",
      }),
    ).toBe("/christmas/family");
  });

  it("mirrors the Deno portraitPromptRegistry helper", () => {
    const cases = [
      {
        productKey: "christmas_pet",
        species: "dog",
        sourceRoute: "/christmas/dogs",
        landingPath: null,
      },
      {
        productKey: "christmas_santa_video",
        species: null,
        sourceRoute: null,
        landingPath: "/christmas/santa-video?ref=ad",
      },
      {
        productKey: "christmas_photo",
        species: null,
        sourceRoute: null,
        landingPath: null,
      },
    ];
    for (const input of cases) {
      expect(recoveryRouteForOrder(input)).toBe(denoRecoveryRouteForOrder(input));
    }
  });

  it("builds the token recovery link from source_route", () => {
    const built = buildDeliveryRecoveryUrl({
      siteOrigin: "https://www.thedigitalgifter.com/",
      token: "tok_family",
      productKey: "christmas_family",
      sourceRoute: "/christmas/family",
    });
    expect(built.recoveryRoute).toBe("/christmas/family");
    expect(built.recoveryUrl).toBe(
      "https://www.thedigitalgifter.com/christmas/family?token=tok_family",
    );
  });
});

describe("photo/santa V1 transactional plan", () => {
  it("skips without Resend keys so tests never send customer email", () => {
    expect(
      planPhotoSantaDeliveryEmail({
        ...configured,
        resendApiKey: "",
        fromAddress: "",
      }),
    ).toEqual({ action: "skip", reason: "unconfigured" });
    expect(
      planPhotoSantaDeliveryEmail({
        ...configured,
        resendApiKey: "re_test_key",
        fromAddress: "",
      }),
    ).toEqual({ action: "skip", reason: "unconfigured" });
  });

  it("skips without recipient or token hint", () => {
    expect(planPhotoSantaDeliveryEmail({ ...configured, email: "  " })).toEqual({
      action: "skip",
      reason: "missing_email",
    });
    expect(planPhotoSantaDeliveryEmail({ ...configured, tokenHint: null })).toEqual({
      action: "skip",
      reason: "missing_token",
    });
  });

  it("plans a Resend send after photo success with source_route token link", () => {
    const plan = planPhotoSantaDeliveryEmail(configured);
    expect(plan.action).toBe("send");
    if (plan.action !== "send") return;
    expect(plan.kind).toBe("portrait");
    expect(plan.to).toBe("buyer@example.com");
    expect(plan.subject).toBe("Your Christmas portrait is ready");
    expect(plan.recoveryRoute).toBe("/christmas/photo-generator");
    expect(plan.recoveryUrl).toContain("/christmas/photo-generator?token=tok_photo_abc");
    expect(plan.html).toContain(plan.recoveryUrl);
    expect(deliveryEmailHasMarketingCopy(`${plan.subject}\n${plan.html}`)).toBe(false);
  });

  it("plans Santa copy and uses the santa source_route", () => {
    const plan = planPhotoSantaDeliveryEmail({
      ...configured,
      productKey: "christmas_santa_video",
      tokenHint: "tok_santa",
      sourceRoute: "/christmas/santa-video",
    });
    expect(deliveryKindForProduct("christmas_santa_video")).toBe("santa");
    expect(plan.action).toBe("send");
    if (plan.action !== "send") return;
    expect(plan.kind).toBe("santa");
    expect(plan.subject).toBe("Your Santa video is ready");
    expect(plan.recoveryUrl).toBe(
      "https://www.thedigitalgifter.com/christmas/santa-video?token=tok_santa",
    );
    expect(deliveryEmailHasMarketingCopy(`${plan.subject}\n${plan.html}`)).toBe(false);
  });

  it("keeps transactional copy free of marketing phrases", () => {
    for (const kind of ["portrait", "santa"] as const) {
      const content = buildPhotoSantaDeliveryContent({
        kind,
        recoveryUrl: "https://www.thedigitalgifter.com/christmas/photo-generator?token=x",
      });
      expect(deliveryEmailHasMarketingCopy(`${content.subject} ${content.html}`)).toBe(false);
      expect(content.html).not.toMatch(/unsubscribe|upgrade|newsletter|discount|cross-sell/i);
    }
  });
});

describe("photo/santa V1 Resend send path", () => {
  it("does not call Resend when unconfigured", async () => {
    const fetchImpl = vi.fn();
    const result = await sendPhotoSantaDeliveryEmail({
      ...configured,
      resendApiKey: "",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ sent: false, reason: "unconfigured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("POSTs to Resend after success when keys are present", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: "re_msg_1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const result = await sendPhotoSantaDeliveryEmail({
      ...configured,
      sourceRoute: "/christmas/cats",
      productKey: "christmas_pet",
      species: "cat",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(result).toEqual({ sent: true, providerMessageId: "re_msg_1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(PHOTO_SANTA_RESEND_ENDPOINT);
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_key");
    const body = JSON.parse(String(init.body)) as {
      from: string;
      to: string[];
      subject: string;
      html: string;
    };
    expect(body.to).toEqual(["buyer@example.com"]);
    expect(body.html).toContain("/christmas/cats?token=tok_photo_abc");
    expect(body.html).not.toMatch(/unsubscribe|upgrade|also try|limited time/i);
  });
});

describe("photo/santa generate wiring", () => {
  it("photo-generate calls the shared seam after success (not inline Resend)", () => {
    const generate = readSrc("supabase/functions/christmas-photo-generate/index.ts");
    expect(generate).toContain('from "../_shared/christmas/deliveryEmail.ts"');
    expect(generate).toContain("sendPhotoSantaDeliveryEmail");
    expect(generate).toContain("sourceRoute:");
    expect(generate).toContain("order.source_route");
    expect(generate).not.toContain("api.resend.com/emails");
  });

  it("santa-generate uses the same seam and source_route (not a hardcoded path)", () => {
    const generate = readSrc("supabase/functions/christmas-santa-generate/index.ts");
    expect(generate).toContain('from "../_shared/christmas/deliveryEmail.ts"');
    expect(generate).toContain("sendPhotoSantaDeliveryEmail");
    expect(generate).toContain("sourceRoute:");
    expect(generate).toContain("order.source_route");
    expect(generate).not.toContain("api.resend.com/emails");
    expect(generate).not.toMatch(/\$\{site\}\/christmas\/santa-video\?token=/);
  });

  it("Deno helper skips without keys and prefers source_route", () => {
    const helper = readSrc("supabase/functions/_shared/christmas/deliveryEmail.ts");
    expect(helper).toContain('reason: "unconfigured"');
    expect(helper).toContain("sourceRoute");
    expect(helper).toContain("recoveryRouteForOrder");
    expect(helper).toContain("RESEND_API_KEY");
    expect(helper).not.toMatch(/unsubscribe|upgrade|cross-sell|newsletter/i);
  });
});
