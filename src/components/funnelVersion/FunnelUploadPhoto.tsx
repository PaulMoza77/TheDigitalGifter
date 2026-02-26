// src/components/funnelVersion/FunnelUploadPhoto.tsx
import React, { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

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

function slugifyFilename(name: string) {
  const parts = name.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".");
  const safe = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60);
  return { safeBase: safe || "photo", ext: (ext || "jpg").toLowerCase() };
}

async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return await file.arrayBuffer();
}

type UploadedFile = {
  file: File;
  localUrl: string; // object URL for local preview
};

export default function FunnelUploadPhoto() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [dragActive, setDragActive] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const stepLabel = useMemo(() => "1 of 3", []);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const acceptFile = useCallback((file: File) => {
    setErrorMsg(null);

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload an image file (JPG/PNG/WebP).");
      return;
    }

    const localUrl = URL.createObjectURL(file);
    setUploaded((prev) => {
      if (prev?.localUrl) URL.revokeObjectURL(prev.localUrl);
      return { file, localUrl };
    });
  }, []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      acceptFile(file);
      e.target.value = ""; // allow re-upload same file
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
    setErrorMsg(null);
    setUploaded((prev) => {
      if (prev?.localUrl) URL.revokeObjectURL(prev.localUrl);
      return null;
    });
  }, []);

  const uploadToSupabase = useCallback(async () => {
    if (!uploaded?.file) {
      setErrorMsg("Please select a photo first.");
      return;
    }

    setIsUploading(true);
    setErrorMsg(null);

    try {
      // ✅ keep consistent across funnel
      const bucket = "templates";
      const folder = "previews";

      const { safeBase, ext } = slugifyFilename(uploaded.file.name);
      const uniq = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const path = `${folder}/${uniq}-${safeBase}.${ext}`;

      const bytes = await fileToArrayBuffer(uploaded.file);

      const { error } = await supabase.storage.from(bucket).upload(path, bytes, {
        contentType: uploaded.file.type || "image/jpeg",
        upsert: false,
        cacheControl: "3600",
      });

      if (error) throw new Error(error.message || "Upload failed");

      // ✅ store for the whole funnel (Preview/Email/Payment/Result)
      try {
        window.localStorage.setItem("tdg_funnel_photo_path", path);
        window.localStorage.setItem("tdg_funnel_bucket", bucket);
        window.localStorage.setItem("tdg_funnel_slug", "newborn");
        window.localStorage.setItem("tdg_funnel_photo", path); // fallback
      } catch {
        // ignore
      }

      // ✅ go to style select
      const qs = new URLSearchParams({
        bucket,
        photo: path,
        slug: "newborn",
      });

      navigate(`/funnel/styleSelect?${qs.toString()}`);
    } catch (e: any) {
      setErrorMsg(e?.message || "Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  }, [navigate, uploaded]);

  return (
    <div className="min-h-screen w-full bg-[#F3EEE6] text-[#111827]">
      {/* Centered brand header (AliveMoment-like) */}
      <div className="pt-10">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="text-sm text-black/60 hover:text-black/80 transition"
              onClick={() => navigate(-1)}
            >
              Back
            </button>

            <div
              className="select-none text-[34px] font-semibold tracking-tight"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              TheDigitalGifter
            </div>

            <div className="text-sm text-black/60">{stepLabel}</div>
          </div>

          <div className="mt-6 h-px w-full bg-black/10" />
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-6 pb-20 pt-10">
        <div className="mx-auto max-w-2xl text-center">
          <h1
            className="text-[30px] leading-tight sm:text-[44px] sm:leading-tight font-semibold"
            style={{ fontFamily: "ui-serif, Georgia, serif", color: "#0F3D2E" }}
          >
            Start with a photo you love
          </h1>
          <p className="mt-3 text-sm sm:text-base text-black/65">
            Upload a special moment. We’ll turn it into a gift-worthy image in minutes.
          </p>
        </div>

        <div className="mx-auto mt-10 w-full max-w-[720px]">
          <div className="rounded-[18px] border border-black/10 bg-white/55 shadow-[0_16px_40px_-26px_rgba(0,0,0,0.35)]">
            <div className="p-6 sm:p-8">
              <div
                className={cn(
                  "relative rounded-[18px] border border-black/10 bg-white/40 p-6 sm:p-8 transition",
                  "shadow-[inset_0_0_0_1px_rgba(0,0,0,0.02)]",
                  dragActive ? "ring-2 ring-[#0F3D2E]/25 bg-[#0F3D2E]/5" : ""
                )}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                role="button"
                tabIndex={0}
                aria-label="Upload photo area"
                onClick={() => {
                  if (!uploaded) openFilePicker();
                }}
              >
                {!uploaded ? (
                  <div className="flex flex-col items-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-black/10 bg-white shadow-sm">
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="text-black/70"
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
                      <div className="text-base sm:text-lg font-semibold text-black/85">
                        Drag &amp; drop your photo here
                      </div>
                      <div className="mt-1 text-sm text-black/55">or click to browse</div>
                    </div>

                    <div className="mt-6 flex w-full items-center justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openFilePicker();
                        }}
                        className="rounded-full bg-[#0F3D2E] px-10 py-3 text-sm font-semibold text-white hover:bg-[#0C3326] transition shadow-[0_14px_40px_-26px_rgba(15,61,46,0.9)]"
                      >
                        Browse photos
                      </button>
                    </div>

                    <div className="mt-4 text-xs text-black/50">
                      Tip: choose a clear, well-lit photo for best results.
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
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-black/55">Selected photo</div>
                        <div className="mt-0.5 truncate text-base font-semibold text-black/85">
                          {uploaded.file.name}
                        </div>
                        <div className="mt-1 text-xs text-black/50">
                          {formatBytes(uploaded.file.size)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeUpload();
                        }}
                        disabled={isUploading}
                        className="rounded-full border border-black/15 bg-white/70 px-4 py-2 text-sm font-semibold text-black/70 hover:bg-white transition disabled:opacity-60"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="mt-5 overflow-hidden rounded-[14px] border border-black/10 bg-white">
                      <img
                        src={uploaded.localUrl}
                        alt="Uploaded preview"
                        className="h-64 w-full object-cover"
                      />
                    </div>

                    {errorMsg ? (
                      <div className="mt-4 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {errorMsg}
                      </div>
                    ) : null}

                    <div className="mt-6 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void uploadToSupabase();
                        }}
                        disabled={isUploading}
                        className="w-full max-w-[420px] rounded-full bg-[#0F3D2E] px-10 py-3 text-sm font-semibold text-white hover:bg-[#0C3326] transition shadow-[0_14px_40px_-26px_rgba(15,61,46,0.9)] disabled:opacity-60"
                      >
                        {isUploading ? "Uploading..." : "Continue"}
                      </button>
                    </div>

                    <div className="mt-3 text-center text-xs text-black/55">
                      Next: choose the style that fits your moment.
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

              {!uploaded ? (
                <div className="mt-6 text-center">
                  <button
                    type="button"
                    className="text-sm font-semibold text-[#0F3D2E] hover:underline"
                    onClick={openFilePicker}
                  >
                    Upload your photo now
                  </button>
                  <div className="mt-2 text-xs text-black/55">
                    Your photo stays private. You control what you share.
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-6 text-center text-xs text-black/50">
            Create a gift-worthy image in minutes. No subscription required.
          </div>
        </div>
      </main>

      <div className="h-14" />
    </div>
  );
}