import { describe, expect, it } from "vitest";
import { santaGreetingCaption, santaReactionForDraft } from "./santaReactions";
import { buildSantaMessagePreview } from "./santaPreview";

describe("santa live reactions", () => {
  it("greets by name without generating media", () => {
    expect(santaGreetingCaption("John")).toMatch(/John/);
    expect(santaGreetingCaption(null)).toMatch(/magical/i);
  });

  it("reacts to age, achievement, wish with text only", () => {
    expect(
      santaReactionForDraft({
        step: "age",
        childFirstName: "John",
        age: "7",
        somethingGood: "",
        hobbyOrInterest: "",
        christmasWish: "",
        senderName: "",
      }),
    ).toMatch(/Seven|important Christmas/i);

    expect(
      santaReactionForDraft({
        step: "wish",
        childFirstName: "John",
        age: "7",
        somethingGood: "",
        hobbyOrInterest: "",
        christmasWish: "a red bicycle",
        senderName: "",
      }),
    ).toMatch(/bicycle|workshop/i);
  });

  it("preview can include hobby and sender", () => {
    const script = buildSantaMessagePreview({
      childFirstName: "John",
      language: "en",
      hobbyOrInterest: "LEGO",
      christmasWish: "a red bicycle",
      senderName: "Mom & Dad",
    });
    expect(script).toMatch(/LEGO/);
    expect(script).toMatch(/Mom & Dad/);
    expect(script).toMatch(/bicycle/i);
  });
});
