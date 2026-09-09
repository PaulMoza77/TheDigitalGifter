import { PageHead } from "@/components/PageHead";
import { ChristmasLandingExperience } from "@/features/christmas/landing/ChristmasLandingExperience";
import { christmasLandingSeo } from "@/features/christmas/landing/seo";

/**
 * Flagship Christmas landing.
 * Hero remains an immersive Christmas world; the rest is scene-based storytelling.
 * Classic generator CTA is preserved: /generator?occasion=christmas
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
        indexable
      />
      <ChristmasLandingExperience />
    </>
  );
}
