import { Button } from "@/components/ui/button";

export function V2GeneratingScreen({
  thumbnailUrl,
  status,
  error,
  busy,
  onRetry,
  onBack,
}: {
  thumbnailUrl: string | null;
  status: string;
  error?: string | null;
  busy?: boolean;
  onRetry: () => void;
  onBack: () => void;
}) {
  return (
    <div className="mx-auto max-w-md space-y-6 py-6 text-center">
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt="Your uploaded pet"
          className="mx-auto h-28 w-28 rounded-2xl object-cover"
        />
      ) : null}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#f6efe4]">Creating your pet’s F1 driver preview</h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">
          We’re turning your pet into a cinematic Formula 1 driver. This is one free preview — not the full collection yet.
        </p>
      </div>
      {error ? (
        <div className="space-y-3 rounded-2xl border border-[#e07a5f]/40 bg-[#e07a5f]/10 px-4 py-4">
          <p className="text-sm text-[#f0b4a0]" role="alert">
            {error}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              className="h-11 flex-1 rounded-full bg-[#d4a84b] text-[#1a140e]"
              disabled={busy}
              onClick={onRetry}
            >
              Try again
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-11 text-[#f6efe4]"
              disabled={busy}
              onClick={onBack}
            >
              Change photo
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#d4a84b]" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}
