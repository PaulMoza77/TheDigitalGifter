import React from "react";

type Props = {
  uploadedFilesLength: number;
  hasSelectedTemplate: boolean;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

export default function UploadSection({
  uploadedFilesLength,
  hasSelectedTemplate,
  onDrop,
  onFileSelect,
}: Props) {
  return (
    <section
      onDrop={onDrop}
      onDragOver={(event) => event.preventDefault()}
      onClick={() => document.getElementById("file-input")?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload photos. Drag and drop or click to select images."
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          document.getElementById("file-input")?.click();
        }
      }}
      className="mx-auto my-8 max-w-4xl cursor-pointer rounded-[28px] border border-white/15 bg-white/[0.055] p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,.35)] transition hover:border-white/25 hover:bg-white/[0.085]"
    >
      <input
        id="file-input"
        type="file"
        accept="image/*"
        multiple
        onChange={onFileSelect}
        aria-label="Select image files"
        className="hidden"
      />

      <h2 className="mb-2 text-xl font-semibold">
        {uploadedFilesLength > 0
          ? `✅ ${uploadedFilesLength} photo${uploadedFilesLength > 1 ? "s" : ""} uploaded`
          : "Drag & drop"}
      </h2>

      <p className="text-[#c1c8d8]">
        {uploadedFilesLength > 0
          ? "Click to add more photos"
          : "or click to upload your reference photos"}
      </p>

      <p className="mt-4 text-sm text-[#c1c8d8]">
        {uploadedFilesLength > 0 && !hasSelectedTemplate
          ? "Now select your desired template below ⬇️"
          : ""}
      </p>
    </section>
  );
}