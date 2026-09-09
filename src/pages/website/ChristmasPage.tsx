import { PageHead } from "@/components/PageHead";
import { ChristmasLandingExperience } from "@/features/christmas/landing/ChristmasLandingExperience";
import { christmasLandingSeo } from "@/features/christmas/landing/seo";

/**
 * Flagship Christmas landing — storytelling hub, not a catalog rebuild.
 * Suite IA: Gift Finder ≠ Christmas Tree ≠ Send a Gift. No checkout CTAs.
 * Classic generator remains adjacent: /generator?occasion=christmas
 * Santa name handoff is owned by ChristmasLandingExperience → /christmas/santa-video?name=
 */
export default function ChristmasPage() {
  const seo = christmasLandingSeo("en");

  return (
    <>
      <PageHead
        title={seo.title}
        description={seo.description}
        image={seo.image}
        url={seo.url}
        exactTitle
      />
      <ChristmasLandingExperience />
    </>
  );
}
