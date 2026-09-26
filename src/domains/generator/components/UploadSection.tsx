import React from "react";

type Props = {
  uploadedFilesLength: number;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
};

export default function UploadSection({
  uploadedFilesLength,
  onDrop,
  inputRef,
}: Props) {
  if (uploadedFilesLength > 0) return null;

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pt-8 sm:pt-12">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--tdg-home-accent)]">
        The Digital Gifter
      </p>
      <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-[var(--tdg-home-text)] sm:text-5xl">
        Create something personal
      </h1>
      <p className="mt-3 max-w-xl text-base leading-7 text-[var(--tdg-home-text-muted)] sm:text-lg">
        Upload a photo and turn it into something worth keeping.
      </p>

      <div
        onDrop={onDrop}
        onDragOver={(event) => event.preventDefault()}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload a photo"
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        className="mt-8 cursor-pointer rounded-[28px] border border-dashed border-[var(--tdg-home-border)] bg-[var(--tdg-home-surface)] px-6 py-14 text-center transition hover:border-[var(--tdg-home-accent)]"
      >
        <p className="text-xl font-semibold text-[var(--tdg-home-text)]">Upload a photo</p>
        <p className="mt-2 text-sm text-[var(--tdg-home-text-muted)]">
          JPG, PNG or WEBP · Max 10 MB · Up to 4 photos
        </p>
      </div>
    </section>
  );
}
