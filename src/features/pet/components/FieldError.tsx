import { cn } from "@/lib/utils";

export function FieldError({
  id,
  message,
}: {
  id: string;
  message?: string;
}) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className="mt-1.5 text-sm text-[#f0b4a0]">
      {message}
    </p>
  );
}

export function petFieldClass(invalid?: boolean) {
  return cn(
    "h-12 rounded-2xl border bg-[#1a1410]/70 px-4 text-base text-[#f6efe4] placeholder:text-[#f6efe4]/35",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a84b] focus-visible:ring-offset-0",
    invalid
      ? "border-[#e07a5f] focus-visible:ring-[#e07a5f]"
      : "border-[#f6efe4]/12"
  );
}
