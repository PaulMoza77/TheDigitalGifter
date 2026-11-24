import { lazy, Suspense } from "react";
import { SANTA_CALL_ROUTE } from "./santaCallTypes";

const ChristmasPageHead = lazy(() =>
  import("@/features/christmas/seo/ChristmasPageHead").then((m) => ({
    default: m.ChristmasPageHead,
  })),
);

/** Isolated chunk so the public landing does not preload the SEO registry. */
export default function SantaCallGatedHead() {
  return (
    <Suspense fallback={null}>
      <ChristmasPageHead path={SANTA_CALL_ROUTE} noindex />
    </Suspense>
  );
}

