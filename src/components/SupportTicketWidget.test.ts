import { describe, expect, it } from "vitest";
import { isSupportWidgetHidden } from "./supportWidgetVisibility";

describe("isSupportWidgetHidden", () => {
  it("hides Help on pet sales funnel pages", () => {
    expect(isSupportWidgetHidden("/pet/dog")).toBe(true);
    expect(isSupportWidgetHidden("/pet/cat")).toBe(true);
    expect(isSupportWidgetHidden("/pet/other")).toBe(true);
    expect(isSupportWidgetHidden("/pet/create")).toBe(true);
    expect(isSupportWidgetHidden("/pet/checkout")).toBe(true);
    expect(isSupportWidgetHidden("/pet/dog-v2")).toBe(true);
    expect(isSupportWidgetHidden("/pet/cat-v2")).toBe(true);
    expect(isSupportWidgetHidden("/pet/other-v2")).toBe(true);
  });

  it("hides Help on Christmas V2 sales funnel, keeps it on results", () => {
    expect(isSupportWidgetHidden("/christmas-ai-photos")).toBe(true);
    expect(isSupportWidgetHidden("/christmas-ai-photos/order")).toBe(false);
  });

  it("keeps Help on the post-purchase order page and the rest of the site", () => {
    expect(isSupportWidgetHidden("/pet/order")).toBe(false);
    expect(isSupportWidgetHidden("/")).toBe(false);
    expect(isSupportWidgetHidden("/account")).toBe(false);
  });
});
