/**
 * Admin-only Santa voice benchmark shell.
 * Restores the missing route target referenced by App.tsx without changing
 * Santa Call production pricing, payments, or live call behavior.
 */
export default function SantaVoiceBenchmarkPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6 text-white">
      <h1 className="text-2xl font-semibold">Santa Voice Benchmark</h1>
      <p className="text-white/70">
        QA and voice benchmark artifacts live under{" "}
        <code className="rounded bg-white/10 px-1.5 py-0.5 text-sm">
          artifacts/santa-call-benchmark/
        </code>
        . This page is a stable admin entry point only.
      </p>
      <ul className="list-disc space-y-2 pl-5 text-white/80">
        <li>Does not start realtime Santa calls.</li>
        <li>Does not create Stripe sessions or change product pricing.</li>
        <li>Use Santa Call admin for live order ops.</li>
      </ul>
      <p className="text-sm text-white/55">
        Ops: open the Christmas Santa Call admin for entitlements and support actions.
      </p>
    </div>
  );
}
