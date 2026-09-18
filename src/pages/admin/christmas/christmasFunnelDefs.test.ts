import { describe, expect, it } from "vitest";
import {
  emailsCollectedInFunnel,
  eventMatchesFunnel,
  funnelById,
  funnelDropoff,
} from "./christmasFunnelDefs";

describe("christmas admin funnel defs", () => {
  it("does not treat every /christmas/* path as club landing", () => {
    const club = funnelById("club");
    expect(club).toBeTruthy();
    expect(
      eventMatchesFunnel(
        { event_name: "planner_landing_view", pathname: "/christmas/planner" },
        club!,
      ),
    ).toBe(false);
    expect(
      eventMatchesFunnel(
        { event_name: "christmas_page_view", pathname: "/christmas" },
        club!,
      ),
    ).toBe(true);
  });

  it("matches gift-tree email claim and reports drop-off", () => {
    const funnel = funnelById("gift_tree")!;
    const rows = [
      { event_name: "christmas_gift_tree_view", funnel_session_id: "a" },
      { event_name: "christmas_gift_tree_view", funnel_session_id: "b" },
      { event_name: "christmas_present_selected", funnel_session_id: "a" },
      { event_name: "christmas_email_claim_success", funnel_session_id: "a" },
    ];
    const drop = funnelDropoff(rows, funnel.steps);
    expect(drop[0].sessions).toBe(2);
    expect(drop[1].sessions).toBe(1);
    expect(drop[1].dropped).toBe(1);
    expect(emailsCollectedInFunnel(rows, funnel)).toBe(1);
  });

  it("matches planner by product key", () => {
    const planner = funnelById("planner")!;
    expect(
      eventMatchesFunnel(
        { event_name: "checkout_started", product_key: "christmas_planner_2026" },
        planner,
      ),
    ).toBe(true);
  });
});
