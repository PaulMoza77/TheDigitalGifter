const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

type PossiblyMessage = { message?: unknown };

export function getErrorMessage(
  error: unknown,
  fallback: string = FALLBACK_MESSAGE
): string {
  if (!error && error !== 0) {
    return fallback;
  }

  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  if (error instanceof Response) {
    return error.statusText || `Request failed with status ${error.status}`;
  }

  if (typeof error === "object") {
    const message = extractMessage(error as PossiblyMessage);
    if (message) {
      return message;
    }
  }

  return fallback;
}

function extractMessage(source: PossiblyMessage): string | null {
  if (!source) {
    return null;
  }

  if (typeof source.message === "string" && source.message.trim()) {
    return source.message;
  }

  if (typeof source.message === "object") {
    return extractMessage(source.message as PossiblyMessage);
  }

  if ("error" in source && typeof (source as any).error === "string") {
    return (source as any).error;
  }

  if ("data" in source && typeof (source as any).data === "string") {
    return (source as any).data;
  }

  return null;
}
