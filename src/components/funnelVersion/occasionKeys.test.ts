import { describe, expect, it } from "vitest";
import { occasionLookupKeys } from "./occasionKeys";

describe("occasionLookupKeys", () => {
  it("keeps christmas as a single key", () => {
    expect(occasionLookupKeys("christmas")).toEqual(["christmas"]);
  });

  it("matches hyphenated template occasions after the funnel normalizes them", () => {
    expect(occasionLookupKeys("mothers_day")).toEqual(
      expect.arrayContaining(["mothers_day", "mothers-day"]),
    );
    expect(occasionLookupKeys("valentines-day", "valentines_day")).toEqual(
      expect.arrayContaining(["valentines-day", "valentines_day"]),
    );
    expect(occasionLookupKeys("newborn")).toEqual(
      expect.arrayContaining(["newborn", "new-born", "new_born"]),
    );
    expect(occasionLookupKeys("thank_you")).toEqual(
      expect.arrayContaining(["thank_you", "thank-you", "thankyou"]),
    );
  });
});
