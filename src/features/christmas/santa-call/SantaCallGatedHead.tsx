import { ChristmasPageHead } from "@/features/christmas/seo/ChristmasPageHead";
import { SANTA_CALL_ROUTE } from "./santaCallTypes";

/** Isolated chunk so the public landing does not preload the SEO registry. */
export default function SantaCallGatedHead() {
  return <ChristmasPageHead path={SANTA_CALL_ROUTE} noindex />;
}
