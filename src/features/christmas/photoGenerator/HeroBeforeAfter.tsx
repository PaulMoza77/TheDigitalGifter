import { BeforeAfterSlider } from "./BeforeAfterSlider";

type Props = { beforeLabel: string; afterLabel: string; ariaLabel: string; hint: string };

/** Drag the divider to reveal the short Christmas clip over the original photo. */
export function HeroBeforeAfter({ beforeLabel, afterLabel, ariaLabel, hint }: Props) {
  return <div className="pg-hero-reveal">
    <BeforeAfterSlider beforeSrc={"/assets/christmas/photo-to-video/family-before.jpeg"} afterSrc={"/assets/christmas/photo-to-video/family-before.jpeg"}
      afterVideoSrc={"/assets/christmas/photo-to-video/family-after.mp4"} beforeAlt="Original family photo"
      afterAlt="Animated Christmas portrait of the same family" beforeLabel={beforeLabel}
      afterLabel={afterLabel} ariaLabel={ariaLabel} eager />
    <p className="pg-reveal-hint">{hint}</p>
  </div>;
}
