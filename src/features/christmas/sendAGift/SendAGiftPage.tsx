import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { trackChristmasEvent } from "../analytics";
import {
  SEND_A_GIFT_PACKAGES,
  SEND_A_GIFT_PACKAGE_KEYS,
  SEND_A_GIFT_PRODUCT_KEY,
  type SendAGiftPackageKey,
} from "./packageComposition";
import { fetchSendAGiftCatalog } from "./sendAGiftApi";
import { copyGiftLink, mailtoGiftLink, nativeShareGift } from "./shareActions";

type Step = "packages" | "personalize" | "checkout" | "share";

export default function SendAGiftPage() {
  const [searchParams] = useSearchParams();
  const recoveryShare = (searchParams.get("share") || "").trim();
  const [step, setStep] = useState<Step>(recoveryShare.length >= 32 ? "share" : "packages");
  const [packageKey, setPackageKey] = useState<SendAGiftPackageKey | null>(null);
  const [senderLabel, setSenderLabel] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [message, setMessage] = useState("");
  const [shareId] = useState(recoveryShare.length >= 32 ? recoveryShare : "");
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [catalogNote, setCatalogNote] = useState<string | null>(null);
  const viewed = useRef(false);

  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    void trackChristmasEvent("send_a_gift_view", {
      productKey: SEND_A_GIFT_PRODUCT_KEY,
      pathname: "/send-a-gift",
      metadata: { funnel: "christmas_send_a_gift" },
    });
    void fetchSendAGiftCatalog().then((c) => {
      if (!c.production_purchasable) {
        setCatalogNote(
          "Checkout is not live yet — founder pricing required (production_purchasable=false).",
        );
      }
    });
  }, []);

  const selected = packageKey ? SEND_A_GIFT_PACKAGES[packageKey] : null;
  const packages = useMemo(
    () => SEND_A_GIFT_PACKAGE_KEYS.map((k) => SEND_A_GIFT_PACKAGES[k]),
    [],
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#1a3a2a_0%,_#0b1220_55%,_#070b14_100%)] text-slate-50">
      <PageHead
        title="Send a Gift | The Digital Gifter"
        description="Prepaid Christmas gift packages with a secure recipient link — no subscription."
        path="/send-a-gift"
      />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-emerald-300/80">The Digital Gifter</p>
          <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Send a Gift</h1>
          <p className="max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
            Choose one of three prepaid packages, personalize your note, and share a secure gift link.
            Recipients redeem included TDG services without paying again.
          </p>
        </header>

        {catalogNote && step !== "share" ? (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {catalogNote}
          </p>
        ) : null}

        {step === "packages" ? (
          <section className="space-y-4" aria-label="Choose package">
            <h2 className="text-lg font-medium">Choose a package</h2>
            <div className="grid gap-3">
              {packages.map((pkg) => (
                <button
                  key={pkg.packageKey}
                  type="button"
                  onClick={() => {
                    setPackageKey(pkg.packageKey);
                    void trackChristmasEvent("package_selected", {
                      productKey: SEND_A_GIFT_PRODUCT_KEY,
                      packageKey: pkg.packageKey,
                      pathname: "/send-a-gift",
                      metadata: { funnel: "christmas_send_a_gift" },
                    });
                    setStep("personalize");
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-left transition hover:border-emerald-400/40 hover:bg-white/10"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-lg font-semibold">{pkg.packageName}</span>
                    <span className="text-xs text-slate-400">Pricing pending</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{pkg.description}</p>
                  <ul className="mt-3 space-y-1 text-sm text-emerald-100/90">
                    {pkg.features.map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {step === "personalize" && selected ? (
          <section className="space-y-4" aria-label="Personalize">
            <h2 className="text-lg font-medium">Personalize — {selected.packageName}</h2>
            <label className="block space-y-1 text-sm">
              <span className="text-slate-400">From</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                value={senderLabel}
                onChange={(e) => setSenderLabel(e.target.value.slice(0, 80))}
                placeholder="Your name"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-slate-400">To</span>
              <input
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                value={recipientLabel}
                onChange={(e) => setRecipientLabel(e.target.value.slice(0, 80))}
                placeholder="Recipient"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-slate-400">Private message (not shown in admin by default)</span>
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                placeholder="Write a short note…"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl border border-white/15 px-4 py-2 text-sm"
                onClick={() => setStep("packages")}
              >
                Back
              </button>
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950"
                onClick={() => {
                  void trackChristmasEvent("personalization_completed", {
                    productKey: SEND_A_GIFT_PRODUCT_KEY,
                    packageKey: selected.packageKey,
                    pathname: "/send-a-gift",
                    metadata: { funnel: "christmas_send_a_gift" },
                  });
                  setStep("checkout");
                }}
              >
                Continue
              </button>
            </div>
          </section>
        ) : null}

        {step === "checkout" && selected ? (
          <section className="space-y-4" aria-label="Checkout">
            <h2 className="text-lg font-medium">Checkout</h2>
            <p className="text-sm text-slate-300">
              Package <strong>{selected.packageName}</strong> is server-owned. Client price overrides are
              rejected. Live Stripe charge is blocked until founder pricing sets purchasable=true.
            </p>
            <p className="text-sm text-slate-400">
              From: {senderLabel || "—"} · To: {recipientLabel || "—"}
            </p>
            <button
              type="button"
              disabled
              className="rounded-xl bg-slate-600 px-4 py-2 text-sm font-medium text-slate-200 opacity-70"
            >
              Pay (not live yet)
            </button>
            <button
              type="button"
              className="ml-3 rounded-xl border border-white/15 px-4 py-2 text-sm"
              onClick={() => setStep("personalize")}
            >
              Back
            </button>
            <p className="text-xs text-slate-500">
              After payment, recover sharing via{" "}
              <code className="text-emerald-200">/send-a-gift?share=…</code> (refresh-safe).
            </p>
          </section>
        ) : null}

        {step === "share" && shareId ? (
          <section className="space-y-4" aria-label="Share gift">
            <h2 className="text-lg font-medium">Share your gift</h2>
            <p className="text-sm text-slate-300">
              Secure recipient link is ready. Success pages are never payment authority — sharing only.
            </p>
            <p className="break-all rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs text-emerald-100">
              {typeof window !== "undefined"
                ? `${window.location.origin}/gift/${shareId}`
                : `/gift/${shareId}`}
            </p>
            {shareHint ? <p className="text-sm text-emerald-200">{shareHint}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950"
                onClick={async () => {
                  const ok = await copyGiftLink(shareId);
                  setShareHint(ok ? "Link copied." : "Could not copy.");
                  void trackChristmasEvent("copy_link", {
                    productKey: SEND_A_GIFT_PRODUCT_KEY,
                    metadata: { funnel: "christmas_send_a_gift" },
                  });
                }}
              >
                Copy link
              </button>
              <button
                type="button"
                className="rounded-xl border border-white/15 px-4 py-2 text-sm"
                onClick={async () => {
                  const result = await nativeShareGift({ shareId });
                  setShareHint(
                    result === "shared"
                      ? "Shared."
                      : result === "copied"
                        ? "Copied."
                        : "Share unavailable.",
                  );
                  void trackChristmasEvent("native_share", {
                    productKey: SEND_A_GIFT_PRODUCT_KEY,
                    metadata: { funnel: "christmas_send_a_gift", result },
                  });
                }}
              >
                Native share
              </button>
              <a
                className="rounded-xl border border-white/15 px-4 py-2 text-sm"
                href={mailtoGiftLink({ shareId })}
                onClick={() => {
                  void trackChristmasEvent("email_requested", {
                    productKey: SEND_A_GIFT_PRODUCT_KEY,
                    metadata: { funnel: "christmas_send_a_gift", channel: "mailto" },
                  });
                }}
              >
                Email link
              </a>
            </div>
          </section>
        ) : null}

        <p className="text-xs text-slate-500">
          Existing tree at{" "}
          <Link className="underline" to="/christmas/tree">
            /christmas/tree
          </Link>{" "}
          is unchanged. This funnel is separate from Gift Tree.
        </p>
      </main>
    </div>
  );
}
