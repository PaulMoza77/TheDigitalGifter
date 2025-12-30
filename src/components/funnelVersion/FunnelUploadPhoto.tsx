import React, { useCallback, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

// TDG Upload Step — Canvas Preview Page
// Inspired by AliveMoment, adapted for TheDigitalGifter
// Single primary action: upload photo

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function formatBytes(bytes: number) {
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let value = bytes;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

type UploadedFile = {
  file: File;
  url: string;
};

export default function Index() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);

  const stepLabel = useMemo(() => "1 of 2", []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const acceptFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setUploaded((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return { file, url };
    });
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      acceptFile(file);
      // reset to allow re-upload same file
      e.target.value = "";
    },
    [acceptFile]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) acceptFile(file);
    },
    [acceptFile]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const removeUpload = useCallback(() => {
    setUploaded((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#f6f1ea] text-zinc-900">
      {/* Top bar */}
      <header className="mx-auto w-full max-w-5xl px-6 pt-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-sm text-zinc-700 hover:text-zinc-900 transition"
          >
            Back
          </button>

          <div className="select-none text-xl tracking-wide font-semibold">
            TheDigitalGifter
          </div>

          <div className="text-sm text-zinc-700">{stepLabel}</div>
        </div>
        <div className="mt-5">
          <Separator className="bg-zinc-200" />
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-5xl px-6">
        <div className="flex flex-col items-center justify-center py-14">
          <h1 className="text-center text-4xl md:text-5xl font-semibold text-[#0b3b2e]">
            Start with a Photo You Love
          </h1>
          <p className="mt-3 max-w-xl text-center text-base md:text-lg text-zinc-700">
            Upload a special moment and turn it into a magical digital gift.
          </p>

          {/* Upload card */}
          <div className="mt-10 w-full max-w-xl">
            <Card className="rounded-3xl border-zinc-200 bg-white/55 shadow-sm">
              <CardContent className="p-6 md:p-8">
                <div
                  className={cn(
                    "relative rounded-3xl border-2 border-dashed p-8 md:p-10 transition",
                    dragActive ? "border-[#0b3b2e] bg-[#0b3b2e]/5" : "border-zinc-300 bg-white/40"
                  )}
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onDragEnter={onDragEnter}
                  onDragLeave={onDragLeave}
                  role="button"
                  tabIndex={0}
                  aria-label="Upload photo area"
                >
                  {!uploaded ? (
                    <div className="flex flex-col items-center">
                      {/* Icon */}
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-200 bg-white shadow-sm">
                        <svg
                          width="22"
                          height="22"
                          viewBox="0 0 24 24"
                          fill="none"
                          xmlns="http://www.w3.org/2000/svg"
                          className="text-zinc-700"
                        >
                          <path
                            d="M4 7C4 5.89543 4.89543 5 6 5H18C19.1046 5 20 5.89543 20 7V17C20 18.1046 19.1046 19 18 19H6C4.89543 19 4 18.1046 4 17V7Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                          <path
                            d="M9 11.5C9.82843 11.5 10.5 10.8284 10.5 10C10.5 9.17157 9.82843 8.5 9 8.5C8.17157 8.5 7.5 9.17157 7.5 10C7.5 10.8284 8.17157 11.5 9 11.5Z"
                            stroke="currentColor"
                            strokeWidth="1.6"
                          />
                          <path
                            d="M4.5 16.5L9.5 12.5L13 16L15.5 13.5L19.5 17.5"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>

                      <div className="mt-5 text-center">
                        <div className="text-base md:text-lg font-medium text-zinc-900">
                          Drag &amp; drop your photo here
                        </div>
                        <div className="mt-1 text-sm text-zinc-600">or</div>
                      </div>

                      <div className="mt-5 w-full flex items-center justify-center">
                        <Button
                          type="button"
                          onClick={openFilePicker}
                          className="h-11 px-10 rounded-full bg-[#0b3b2e] hover:bg-[#082c22] text-white"
                        >
                          Browse photos
                        </Button>
                      </div>

                      <div className="mt-4 text-xs text-zinc-500">
                        94% of users upload a photo at this step
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onInputChange}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm text-zinc-600">Selected photo</div>
                          <div className="text-base font-semibold text-zinc-900 truncate max-w-[260px] md:max-w-[420px]">
                            {uploaded.file.name}
                          </div>
                          <div className="text-xs text-zinc-500">{formatBytes(uploaded.file.size)}</div>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={removeUpload}
                          className="rounded-full"
                        >
                          Remove
                        </Button>
                      </div>

                      <div className="mt-5 overflow-hidden rounded-2xl border bg-white">
                        <img
                          src={uploaded.url}
                          alt="Uploaded preview"
                          className="h-64 w-full object-cover"
                        />
                      </div>

                      <div className="mt-5 flex items-center justify-center">
                        <Button
                          type="button"
                          className="h-11 px-10 rounded-full bg-[#0b3b2e] hover:bg-[#082c22] text-white"
                        >
                          Continue
                        </Button>
                      </div>

                      <div className="mt-3 text-center text-xs text-zinc-500">
                        One photo is all it takes to create something unforgettable.
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onInputChange}
                      />
                    </div>
                  )}
                </div>

                {/* Secondary option */}
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    className="text-sm font-medium text-[#0b3b2e] hover:underline"
                  >
                    Upload photo later
                  </button>
                  <div className="mt-2 text-xs text-zinc-600">
                    Your photo stays private. You control what you share.
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tiny hint/footer */}
            <div className="mt-6 text-center text-xs text-zinc-500">
              Create your digital gift in minutes. No Subscription required.
            </div>
          </div>
        </div>
      </main>

      {/* Bottom spacing */}
      <div className="h-14" />
    </div>
  );
}
