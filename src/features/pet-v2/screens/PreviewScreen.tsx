import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  canUnlockWithIdentityConfirm,
  identityConfirmLabel,
  type IdentityConfirmKind,
} from "../../pet-funnel-shared/identityConfirm";
import { petSpeciesWord, usePetLocale, usePetT, usePetCurrency } from "../../pet/i18n";
import { V2PackOffer, v2PackOfferCopy } from "../V2PackOffer";
import type { PetV2Species } from "../types";

export function V2PreviewScreen({
  previewUrl,
  sourceUrl,
  petName,
  species = "dog",
  mode,
  canRegenerate,
  onRegenerate,
  onUnlock,
}: {
  previewUrl: string;
  sourceUrl?: string | null;
  petName?: string;
  species?: PetV2Species;
  mode: "live" | "mock" | null;
  canRegenerate: boolean;
  onRegenerate: () => void;
  onUnlock: () => void;
}) {
  const locale = usePetLocale();
  const t = usePetT(locale);
  const currency = usePetCurrency();
  const [offer, setOffer] = useState(() => v2PackOfferCopy(Date.now(), currency));
  useEffect(() => {
    setOffer(v2PackOfferCopy(Date.now(), currency));
  }, [currency]);
  const [identityConfirmed, setIdentityConfirmed] = useState(false);
  const [identityError, setIdentityError] = useState<string | undefined>();
  const petLabel = petSpeciesWord(species, locale, "lower");
  const confirmKind: IdentityConfirmKind =
    species === "cat" ? "cat" : species === "other" ? "pet" : "dog";
  const headline = petName?.trim()
    ? t("v2.preview.h1Named", { name: petName.trim() })
    : t("v2.preview.h1", { pet: petLabel });

  return (
    <div className="space-y-6 pb-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#d4a84b]">
          {t("v2.preview.eyebrow")}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f6efe4]">{headline}</h1>
        <p className="mt-2 text-sm leading-6 text-[#f6efe4]/68">
          {t("v2.preview.lede", { pet: petLabel })}
        </p>
      </div>
      {sourceUrl ? (
        <div className="grid grid-cols-2 gap-3">
          <figure className="overflow-hidden rounded-2xl border border-[#d4a84b]/20 bg-[#1a1410]">
            <img
              src={sourceUrl}
              alt={t("v2.preview.uploadAlt", { pet: petLabel })}
              className="aspect-square w-full object-cover"
            />
            <figcaption className="px-3 py-2 text-center text-xs text-[#f6efe4]/55">
              {t("v2.preview.yourPhoto")}
            </figcaption>
          </figure>
          <figure className="overflow-hidden rounded-2xl border border-[#d4a84b]/30 bg-[#1a1410]">
            <img
              src={previewUrl}
              alt={t("v2.preview.f1Alt", { pet: petLabel })}
              className="aspect-square w-full object-cover"
            />
            <figcaption className="px-3 py-2 text-center text-xs text-[#f6efe4]/55">
              {t("v2.preview.f1")}
            </figcaption>
          </figure>
        </div>
      ) : (
        <figure className="overflow-hidden rounded-3xl border border-[#d4a84b]/30 bg-[#1a1410]">
          <img
            src={previewUrl}
            alt={t("v2.preview.f1Alt", { pet: petLabel })}
            className="w-full object-cover"
          />
        </figure>
      )}
      {mode === "mock" ? (
        <p className="rounded-2xl border border-[#d4a84b]/30 bg-[#d4a84b]/10 px-4 py-3 text-sm text-[#f3d48a]">
          {t("v2.preview.mock")}
        </p>
      ) : null}
      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#d4a84b]/25 bg-[#1a1410]/80 px-4 py-3 text-sm leading-5 text-[#f6efe4]/85">
        <input
          type="checkbox"
          checked={identityConfirmed}
          onChange={(e) => {
            setIdentityConfirmed(e.target.checked);
            setIdentityError(undefined);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#d4a84b]"
        />
        <span>{identityConfirmLabel(confirmKind)}</span>
      </label>
      {identityError ? <p className="text-sm text-[#f3a6a6]">{identityError}</p> : null}
      <V2PackOffer onExpire={() => setOffer(v2PackOfferCopy(Date.now(), currency))} />
      <ul className="space-y-1.5 text-sm text-[#f6efe4]/68">
        <li>{t("v2.teaser.bullet.lives", { pet: petLabel })}</li>
        <li>{t("v2.teaser.bullet.clips")}</li>
        <li>{t("v2.teaser.bullet.price", { price: offer.priceDisplay })}</li>
      </ul>
      <Button
        type="button"
        onClick={() => {
          const gate = canUnlockWithIdentityConfirm({ confirmed: identityConfirmed, kind: confirmKind });
          if (!gate.ok) {
            setIdentityError(gate.message);
            return;
          }
          onUnlock();
        }}
        className="h-12 min-h-[48px] w-full rounded-full bg-[#d4a84b] text-base font-semibold text-[#1a140e] hover:bg-[#e2bc63]"
      >
        {t("v2.preview.unlock", { price: offer.priceDisplay })}
      </Button>
      {canRegenerate ? (
        <button
          type="button"
          onClick={() => {
            setIdentityConfirmed(false);
            setIdentityError(undefined);
            onRegenerate();
          }}
          className="block w-full text-center text-sm text-[#f6efe4]/60 underline-offset-4 hover:underline"
        >
          {t("v2.preview.regen")}
        </button>
      ) : null}
    </div>
  );
}
