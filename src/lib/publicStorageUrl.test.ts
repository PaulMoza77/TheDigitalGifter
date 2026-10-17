import { describe, expect, it } from "vitest";
import { getTemplateImageUrl } from "@/domains/generator/components/generatorUtils";
import { reachablePublicStorageUrl } from "@/lib/publicStorageUrl";
import { reachablePublicStorageUrl as edgeReachablePublicStorageUrl } from "../../supabase/functions/_shared/publicStorageUrl";

const blocked =
  "https://kjlsocejpmnzhhduyumy.supabase.co/storage/v1/object/public/occasion-collections/fathers-day/cover.png";
const reachable =
  "https://supabase.thedigitalgifter.com/storage/v1/object/public/occasion-collections/fathers-day/cover.png";

describe("reachable public storage urls", () => {
  it("points quota-blocked template previews at the domain that still serves them", () => {
    expect(reachablePublicStorageUrl(blocked)).toBe(reachable);
    expect(edgeReachablePublicStorageUrl(blocked)).toBe(reachable);
    expect(reachablePublicStorageUrl(reachable)).toBe(reachable);
    expect(reachablePublicStorageUrl("https://cdn.example/photo.jpg")).toBe(
      "https://cdn.example/photo.jpg",
    );
    expect(
      getTemplateImageUrl({
        preview_url: blocked,
      }),
    ).toBe(reachable);
  });
});
