import { useMemo, useState } from "react";
import { Toaster } from "sonner";
import { PetCheckoutPage } from "./PetCheckoutPage";
import { PetCreatePage } from "./PetCreatePage";
import { PetLandingPage } from "./PetLandingPage";
import { PetOrderPage } from "./PetOrderPage";
import {
  PREVIEW_ORDER_PRESETS,
  createPreviewOrderFixture,
  createPreviewPetApi,
  createPreviewResults,
  setPreviewOrderPreset,
  type PreviewOrderPreset,
} from "./previewApi";
import {
  createEmptyPetDraft,
  createSafePhotoPreview,
  savePetDraft,
  setPetPhotoFile,
} from "./storage";
import type { PetFunnelNavigation, PetPageId } from "./types";
import { cn } from "@/lib/utils";

type CreatePreset = "empty" | "filled" | "errors";

const PAGES: Array<{ id: PetPageId; label: string }> = [
  { id: "landing", label: "Landing" },
  { id: "create", label: "Create" },
  { id: "checkout", label: "Checkout" },
  { id: "order", label: "Order" },
];

const CREATE_PRESETS: Array<{ id: CreatePreset; label: string }> = [
  { id: "empty", label: "Empty form" },
  { id: "filled", label: "Filled form" },
  { id: "errors", label: "Validation errors" },
];

export function PetFunnelPreview() {
  const [page, setPage] = useState<PetPageId>("landing");
  const [createPreset, setCreatePreset] = useState<CreatePreset>("empty");
  const [orderPreset, setOrderPreset] = useState<PreviewOrderPreset>("processing");
  const [publicToken, setPublicToken] = useState("preview_processing");
  const [draftNonce, setDraftNonce] = useState(0);
  const api = useMemo(() => createPreviewPetApi(), []);

  const navigation: PetFunnelNavigation = {
    goToLanding: () => setPage("landing"),
    goToCreate: () => setPage("create"),
    goToCheckout: () => setPage("checkout"),
    goToOrder: (token) => {
      if (token) setPublicToken(token);
      setPage("order");
    },
  };

  const previewOrder = createPreviewOrderFixture(orderPreset, {
    petName: "Maple",
    email: "gift@example.com",
    species: "dog",
    personality: "funny",
  });
  previewOrder.publicToken = publicToken;

  async function applyCreatePreset(next: CreatePreset) {
    setCreatePreset(next);
    setPage("create");
    if (next === "empty" || next === "errors") {
      setPetPhotoFile(null);
      savePetDraft(createEmptyPetDraft());
      setDraftNonce((value) => value + 1);
      return;
    }
    await seedFilledDraft();
    setDraftNonce((value) => value + 1);
  }

  function applyOrderPreset(next: PreviewOrderPreset) {
    setOrderPreset(next);
    setPreviewOrderPreset(next);
    setPublicToken(`preview_${next}`);
    setPage("order");
  }

  return (
    <div className="min-h-screen bg-[#0c0907]">
      <Toaster position="top-center" richColors />
      <div className="sticky top-0 z-40 border-b border-[#f6efe4]/10 bg-[#0c0907]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs uppercase tracking-[0.18em] text-[#d4a84b]">
              Local pet funnel preview · no backend
            </p>
            <p className="text-xs text-[#f6efe4]/55">
              Routes are not registered in App.tsx. Review every UI state here.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Pet funnel pages">
            {PAGES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={page === item.id}
                className={chipClass(page === item.id)}
                onClick={() => setPage(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {page === "create" ? (
            <div className="flex flex-wrap gap-2" aria-label="Create page states">
              {CREATE_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={chipClass(createPreset === item.id, true)}
                  onClick={() => void applyCreatePreset(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          {page === "order" ? (
            <div className="flex flex-wrap gap-2" aria-label="Order page states">
              {PREVIEW_ORDER_PRESETS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={chipClass(orderPreset === item.id, true)}
                  onClick={() => applyOrderPreset(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div key={`${page}-${createPreset}-${orderPreset}-${draftNonce}`}>
        {page === "landing" ? <PetLandingPage navigation={navigation} /> : null}
        {page === "create" ? (
          <PetCreatePage navigation={navigation} forceErrors={createPreset === "errors"} />
        ) : null}
        {page === "checkout" ? (
          <PetCheckoutPage navigation={navigation} api={api} />
        ) : null}
        {page === "order" ? (
          <PetOrderPage
            navigation={navigation}
            api={api}
            publicToken={publicToken}
            previewOrder={previewOrder}
            previewResults={createPreviewResults(previewOrder)}
          />
        ) : null}
      </div>
    </div>
  );
}

function chipClass(active: boolean, subtle = false) {
  return cn(
    "rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a84b]",
    active
      ? "border-[#d4a84b] bg-[#d4a84b] text-[#1a140e]"
      : subtle
        ? "border-[#f6efe4]/15 bg-transparent text-[#f6efe4]/80 hover:border-[#f6efe4]/35"
        : "border-[#f6efe4]/20 bg-[#1a1410] text-[#f6efe4] hover:border-[#d4a84b]/50"
  );
}

async function seedFilledDraft() {
  const file = await makeSamplePhotoFile();
  setPetPhotoFile(file);
  const preview = await createSafePhotoPreview(file);
  savePetDraft({
    petName: "Maple",
    species: "dog",
    personality: "funny",
    email: "gift@example.com",
    photo: {
      fileName: file.name,
      contentType: "image/jpeg",
      byteSize: file.size,
      width: 640,
      height: 800,
    },
    photoPreviewDataUrl: preview,
    updatedAt: new Date().toISOString(),
  });
}

async function makeSamplePhotoFile(): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 800;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return new File([new Blob(["maple"], { type: "image/jpeg" })], "maple.jpg", {
      type: "image/jpeg",
    });
  }
  const gradient = ctx.createLinearGradient(0, 0, 0, 800);
  gradient.addColorStop(0, "#5b3a1e");
  gradient.addColorStop(1, "#d4a84b");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 640, 800);
  ctx.fillStyle = "#f6efe4";
  ctx.font = "bold 42px Inter, sans-serif";
  ctx.fillText("MAPLE", 48, 720);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => {
      if (value) resolve(value);
      else reject(new Error("Could not create sample photo"));
    }, "image/jpeg", 0.85);
  });

  return new File([blob], "maple.jpg", { type: "image/jpeg" });
}
