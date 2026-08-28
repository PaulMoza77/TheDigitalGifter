import { Button } from "@/components/ui/button";

export function V2GeneratingScreen({
  thumbnailUrl,
  status,
  error,
  errorTitle,
  busy,
  allowRetry = true,
  onRetry,
  onBack,
}: {
  thumbnailUrl: string | null;
  status: string;
  error?: string | null;
  errorTitle?: string | null;
  busy?: boolean;
  /** When false (e.g. rate limited), hide auto-retry hammering. */
  allowRetry?: boolean;
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
        <h1 className="text-2xl font-semibold tracking-tight text-[#f6efe4]">
          {error ? errorTitle || "Preview didn’t finish" : "Creating your pet’s F1 driver preview"}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/65">
          {error
            ? "You can change the photo or unlock the collection when you’re ready."
            : "We’re turning your pet into a cinematic Formula 1 driver. This is one free preview — not the full collection yet."}
        </p>
      </div>
      {error ? (
        <div className="space-y-3 rounded-2xl border border-[#e07a5f]/40 bg-[#e07a5f]/10 px-4 py-4">
          <p className="text-sm text-[#f0b4a0]" role="alert">
            {error}
          </p>
          <div className="flex gap-2">
            {allowRetry ? (
              <Button
                type="button"
                className="h-11 flex-1 rounded-full bg-[#d4a84b] text-[#1a140e]"
                disabled={busy}
                onClick={onRetry}
              >
                Try again
              </Button>
            ) : null}
            <Button
              type="button"
              variant={allowRetry ? "ghost" : undefined}
              className={
                allowRetry
                  ? "h-11 text-[#f6efe4]"
                  : "h-11 flex-1 rounded-full bg-[#d4a84b] text-[#1a140e]"
              }
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
