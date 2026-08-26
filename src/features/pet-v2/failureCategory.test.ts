import { describe, expect, it } from "vitest";
import { buildHybridStages } from "../pet/funnelHybrid";
import { emptyStepCounts } from "../pet/funnelDashboard";
import { FUNNEL_DATASETS, mapV2CountsToPrimarySteps, namedEventCounts } from "../pet/funnelDatasetConfig";
import {
  isPetV2PersistenceFailureCategory,
  isPetV2RejectedRequestCategory,
  normalizeV2FailureCategory,
  resolveInitiateCheckoutDisplay,
} from "./failureCategory";

describe("V2 analytics clarity", () => {
  it("renders v2_upload_completed as Photos Selected", () => {
    expect(FUNNEL_DATASETS.v2.kpiLabels.step2).toBe("Photos Selected");
    expect(FUNNEL_DATASETS.v2.kpiLabels.step2Helper).toContain("Client-validated photo selections");
    expect(FUNNEL_DATASETS.v2.kpiLabels.step2Helper).toContain("does not mean the photo was uploaded");
    expect(FUNNEL_DATASETS.v2.stageLabels.pet_name_submitted).toBe("Photos Selected");
    const counts = mapV2CountsToPrimarySteps(
      namedEventCounts([{ event_name: "v2_upload_completed", unique_sessions: 14 }]),
    );
    expect(counts.pet_name_submitted).toBe(14);
  });

  it("keeps customer Initiate Checkout KPI separate from internal and first-party begin checkout", () => {
    const display = resolveInitiateCheckoutDisplay({
      customerCheckouts: 0,
      internalCheckouts: 1,
      testCheckouts: 0,
      firstPartyBeginCheckout: 1,
    });
    expect(display.customerKpi).toBe(0);
    expect(display.internalOrTest).toBe(1);
    expect(display.firstPartyBeginCheckout).toBe(1);
    expect(display.helper).toContain("excluded");

    const customer = resolveInitiateCheckoutDisplay({
      customerCheckouts: 3,
      internalCheckouts: 1,
      testCheckouts: 2,
      firstPartyBeginCheckout: 5,
    });
    expect(customer.customerKpi).toBe(3);

    const firstParty = emptyStepCounts();
    firstParty.landing_view = 10;
    firstParty.pet_name_submitted = 5;
    firstParty.photo_upload_completed = 4;
    firstParty.order_review_viewed = 2;
    firstParty.initiate_checkout = 9; // FP diagnostic — must not win
    firstParty.purchase = 0;
    const stages = buildHybridStages({
      mode: "first_party",
      firstPartyCounts: firstParty,
      backendCheckouts: 0,
      backendPurchases: 0,
      meta: {
        landingPageViews: 0,
        initiateCheckouts: 0,
        purchases: 0,
        petNameSubmitted: null,
        photoUploadCompleted: null,
        orderReviewViewed: null,
      },
      ga4: {
        landingViews: 0,
        petNameSubmitted: null,
        photoUploadCompleted: null,
        orderReviewViewed: null,
        beginCheckouts: 0,
      },
    });
    expect(stages.find((s) => s.eventName === "initiate_checkout")?.value).toBe(0);
    expect(stages.find((s) => s.eventName === "initiate_checkout")?.source).toBe("backend_truth");
  });

  it("normalizes failure categories safely without raw exception text", () => {
    expect(normalizeV2FailureCategory("rate_limit")).toBe("rate_limit");
    expect(normalizeV2FailureCategory("heic_unsupported")).toBe("heic_unsupported");
    expect(normalizeV2FailureCategory("invalid_image")).toBe("validation");
    expect(normalizeV2FailureCategory("provider_error")).toBe("provider");
    expect(normalizeV2FailureCategory("endpoint_unreachable")).toBe("network");
    expect(normalizeV2FailureCategory("timeout")).toBe("timeout");
    expect(normalizeV2FailureCategory("live_disabled")).toBe("pre_provider");
    expect(normalizeV2FailureCategory("Error: SECRET_TOKEN=abc @user@x.com")).toBe("unknown");
    expect(normalizeV2FailureCategory(null)).toBeNull();
  });

  it("treats only persistence categories as failed analytics writes", () => {
    expect(isPetV2PersistenceFailureCategory("rpc_error")).toBe(true);
    expect(isPetV2PersistenceFailureCategory("write_failed")).toBe(true);
    expect(isPetV2PersistenceFailureCategory("missing_supabase_config")).toBe(true);
    expect(isPetV2PersistenceFailureCategory("origin_denied")).toBe(false);
    expect(isPetV2PersistenceFailureCategory("malformed_json")).toBe(false);
    expect(isPetV2PersistenceFailureCategory("rate_limit")).toBe(false);
    expect(isPetV2PersistenceFailureCategory("provider")).toBe(false);
    expect(isPetV2RejectedRequestCategory("origin_denied")).toBe(true);
    expect(isPetV2RejectedRequestCategory("invalid_event")).toBe(true);
    expect(isPetV2RejectedRequestCategory("rpc_error")).toBe(false);
  });

  it("does not change V1 dataset labels", () => {
    expect(FUNNEL_DATASETS.v1.kpiLabels.step2).toBe("Names Submitted");
    expect(FUNNEL_DATASETS.v1.kpiLabels.step3).toBe("Photos Selected");
    expect(FUNNEL_DATASETS.v1.campaignId).toBe("120253346791240170");
  });
});
