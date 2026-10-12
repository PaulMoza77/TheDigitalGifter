import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { PageHead } from "@/components/PageHead";
import { trackMemoriesEvent } from "./analytics";
import { memoriesApi, uploadFileToSignedUrl } from "./api";
import {
  MEMORIES_CREATE_ROUTE,
  MEMORIES_PLANS,
  MEMORIES_PLANS_ROUTE,
  MEMORIES_ROUTE,
  MEMORIES_SUCCESS_ROUTE,
  type MemoriesPlanKey,
} from "./config";
import { MemoriesShell } from "./MemoriesShell";
import { createLocalPreview, validateMemoriesPhotoFile } from "./photo";
import { MemoriesCreateScreen } from "./screens/CreateScreen";
import { MemoriesLandingScreen } from "./screens/LandingScreen";
import { MemoriesPlansScreen } from "./screens/PlansScreen";
import { MemoriesSuccessScreen } from "./screens/SuccessScreen";
import { loadMemoriesDraft, saveMemoriesDraft } from "./storage";
import type { MemoriesDraft, MemoriesUploadItem } from "./types";

function cryptoRandomId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ensureFonts() {
  const id = "memories-fonts";
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,650;9..144,700&family=Nunito+Sans:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

export function MemoriesLandingPage() {
  return (
    <>
      <PageHead
        title="Memories by The Digital Gifter — Bring Their Memories to Life"
        description="Preserve meaningful moments and explore early access to Memories — a future AI-powered memory preservation product by The Digital Gifter."
        url="https://www.thedigitalgifter.com/memories"
      />
      <MemoriesLandingScreen />
    </>
  );
}

export function MemoriesCreatePage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<MemoriesDraft>(() => loadMemoriesDraft());
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string>();
  const fileCache = useState(() => new Map<string, File>())[0];

  useEffect(() => {
    ensureFonts();
    void memoriesApi.upsertSession("create");
  }, []);

  useEffect(() => {
    saveMemoriesDraft({ ...draft, step: "create" });
  }, [draft]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    trackMemoriesEvent({ eventName: "memories_upload_started", pathname: MEMORIES_CREATE_ROUTE });
    setUploadError(undefined);
    for (const file of Array.from(files)) {
      const check = validateMemoriesPhotoFile(file);
      if (!check.ok) {
        setUploadError(check.message);
        continue;
      }
      const localId = cryptoRandomId();
      let preview = "";
      try {
        preview = await createLocalPreview(file);
      } catch {
        preview = "";
      }
      fileCache.set(localId, file);
      const item: MemoriesUploadItem = {
        uploadId: localId,
        publicToken: "",
        fileName: file.name,
        contentType: check.contentType || file.type,
        byteSize: file.size,
        previewDataUrl: preview,
        status: "uploading",
        progress: 8,
      };
      setDraft((d) => ({ ...d, uploads: [...d.uploads, item] }));

      try {
        const signed = await memoriesApi.createUploadUrl({
          contentType: item.contentType,
          fileName: item.fileName,
          byteSize: item.byteSize,
        });
        if (!signed.ok || !signed.signedUrl) {
          throw new Error(String(signed.error || "Could not start upload"));
        }
        setDraft((d) => ({
          ...d,
          uploads: d.uploads.map((u) =>
            u.uploadId === localId
              ? {
                  ...u,
                  uploadId: String(signed.uploadId),
                  publicToken: String(signed.publicToken),
                  progress: 45,
                }
              : u,
          ),
        }));
        fileCache.set(String(signed.uploadId), file);
        fileCache.delete(localId);
        await uploadFileToSignedUrl(file, String(signed.signedUrl), String(signed.token || ""));
        setDraft((d) => ({
          ...d,
          uploads: d.uploads.map((u) =>
            u.uploadId === String(signed.uploadId) || u.uploadId === localId
              ? { ...u, uploadId: String(signed.uploadId), progress: 85, status: "uploading" }
              : u,
          ),
        }));
        const confirmed = await memoriesApi.confirmUpload(
          String(signed.uploadId),
          String(signed.publicToken),
        );
        if (!confirmed.ok) throw new Error(String(confirmed.error || "Confirm failed"));
        setDraft((d) => ({
          ...d,
          uploads: d.uploads.map((u) =>
            u.uploadId === String(signed.uploadId)
              ? { ...u, status: "uploaded", progress: 100 }
              : u,
          ),
        }));
        trackMemoriesEvent({
          eventName: "memories_upload_completed",
          pathname: MEMORIES_CREATE_ROUTE,
          attemptId: String(signed.uploadId),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed";
        setDraft((d) => ({
          ...d,
          uploads: d.uploads.map((u) =>
            u.uploadId === localId || fileCache.has(u.uploadId)
              ? { ...u, status: "failed", error: message }
              : u,
          ),
        }));
        setUploadError(message);
      }
    }
  }

  async function handleRemove(uploadId: string) {
    const item = draft.uploads.find((u) => u.uploadId === uploadId);
    if (item?.publicToken) {
      await memoriesApi.removeUpload(uploadId, item.publicToken).catch(() => undefined);
    }
    fileCache.delete(uploadId);
    setDraft((d) => ({ ...d, uploads: d.uploads.filter((u) => u.uploadId !== uploadId) }));
  }

  async function handleContinue() {
    setBusy(true);
    setUploadError(undefined);
    try {
      // Ensure any local-only files attempted upload
      const pending = draft.uploads.filter((u) => u.status === "local");
      if (pending.length) {
        // treat as needing upload — block
        setUploadError("Please wait for uploads to finish.");
        setBusy(false);
        return;
      }
      const res = await memoriesApi.submitEmail({
        email: draft.email,
        fullName: draft.fullName,
        marketingOptIn: draft.marketingOptIn,
        processingConsent: draft.processingConsent,
        authorityAck: draft.authorityAck,
      });
      if (!res.ok) throw new Error(String(res.error || "Could not save email"));
      trackMemoriesEvent({ eventName: "memories_email_submitted", pathname: MEMORIES_CREATE_ROUTE });
      navigate(MEMORIES_PLANS_ROUTE);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Create Your Memory — Memories"
        description="Upload photographs and join Memories early access by The Digital Gifter."
        url="https://www.thedigitalgifter.com/memories/create"
      />
      <MemoriesShell>
        <MemoriesCreateScreen
          draft={draft}
          busy={busy}
          uploadError={uploadError}
          onFiles={handleFiles}
          onRemove={handleRemove}
          onEmailChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onConsentChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onContinue={handleContinue}
        />
      </MemoriesShell>
    </>
  );
}

export function MemoriesPlansPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [draft, setDraft] = useState<MemoriesDraft>(() => loadMemoriesDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<{
    commercialMode: string;
    chargingEnabled: boolean;
    disclosures: Record<string, string>;
  }>({
    commercialMode: "waitlist",
    chargingEnabled: false,
    disclosures: {},
  });

  useEffect(() => {
    ensureFonts();
    trackMemoriesEvent({ eventName: "memories_plan_viewed", pathname: MEMORIES_PLANS_ROUTE });
    void memoriesApi.upsertSession("plans");
    void memoriesApi.config().then((res) => {
      if (!res.ok) return;
      setConfig({
        commercialMode: String(res.commercialMode || "waitlist"),
        chargingEnabled: res.chargingEnabled === true,
        disclosures: (res.disclosures as Record<string, string>) || {},
      });
      setDraft((d) => ({ ...d, commercialMode: String(res.commercialMode || "waitlist") }));
    });
    if (search.get("checkout") === "canceled") {
      trackMemoriesEvent({ eventName: "memories_checkout_canceled", pathname: MEMORIES_PLANS_ROUTE });
    }
  }, [search]);

  useEffect(() => {
    saveMemoriesDraft({ ...draft, step: "plans" });
  }, [draft]);

  if (!draft.email) {
    return <Navigate to={MEMORIES_CREATE_ROUTE} replace />;
  }

  async function handleCheckout() {
    if (!draft.selectedPlanKey) return;
    setBusy(true);
    setError(null);
    try {
      await memoriesApi.selectPlan(draft.selectedPlanKey);
      trackMemoriesEvent({
        eventName: "memories_plan_selected",
        product: MEMORIES_PLANS[draft.selectedPlanKey].sku,
        amountCents: MEMORIES_PLANS[draft.selectedPlanKey].amountCents,
        pathname: MEMORIES_PLANS_ROUTE,
      });
      trackMemoriesEvent({
        eventName: "memories_checkout_started",
        product: MEMORIES_PLANS[draft.selectedPlanKey].sku,
        amountCents: MEMORIES_PLANS[draft.selectedPlanKey].amountCents,
        pathname: MEMORIES_PLANS_ROUTE,
      });
      const res = await memoriesApi.createCheckout(
        draft.selectedPlanKey,
        `memories_${draft.selectedPlanKey}_${Date.now()}`,
      );
      if (!res.ok) throw new Error(String(res.error || "Checkout failed"));
      const token = String(res.publicToken || "");
      setDraft((d) => ({
        ...d,
        orderId: String(res.orderId || ""),
        publicToken: token,
        commercialMode: String(res.mode || config.commercialMode),
      }));
      if (res.charged === true && res.url) {
        window.location.href = String(res.url);
        return;
      }
      trackMemoriesEvent({
        eventName: "memories_waitlist_joined",
        product: MEMORIES_PLANS[draft.selectedPlanKey].sku,
        pathname: MEMORIES_SUCCESS_ROUTE,
      });
      navigate(`${MEMORIES_SUCCESS_ROUTE}?token=${encodeURIComponent(token)}&mode=waitlist`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Memories Plans"
        description="Choose a Memories monthly early-access plan from The Digital Gifter."
        url="https://www.thedigitalgifter.com/memories/plans"
      />
      <MemoriesShell>
        <MemoriesPlansScreen
          selectedPlanKey={draft.selectedPlanKey}
          commercialMode={config.commercialMode}
          chargingEnabled={config.chargingEnabled}
          disclosures={config.disclosures}
          busy={busy}
          error={error}
          onSelect={(key: MemoriesPlanKey) => setDraft((d) => ({ ...d, selectedPlanKey: key }))}
          onCheckout={handleCheckout}
        />
      </MemoriesShell>
    </>
  );
}

export function MemoriesSuccessPage() {
  const [search] = useSearchParams();
  const token = search.get("token") || loadMemoriesDraft().publicToken || "";
  const mode = search.get("mode");
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [state, setState] = useState<{
    paymentVerified: boolean;
    waitlisted: boolean;
    planKey: MemoriesPlanKey | null;
    status: string | null;
    commercialMode: string | null;
  }>({
    paymentVerified: false,
    waitlisted: mode === "waitlist",
    planKey: null,
    status: null,
    commercialMode: mode,
  });

  useEffect(() => {
    ensureFonts();
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      const res = await memoriesApi.orderStatus(token);
      if (cancelled) return;
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const order = (res.order || {}) as Record<string, unknown>;
      const verified = res.paymentVerified === true;
      setState({
        paymentVerified: verified,
        waitlisted: String(order.status) === "waitlisted" || mode === "waitlist",
        planKey: (order.plan_key as MemoriesPlanKey) || null,
        status: String(order.status || ""),
        commercialMode: String(order.commercial_mode || mode || ""),
      });
      if (verified) {
        trackMemoriesEvent({
          eventName: "memories_payment_verified",
          product: String(order.plan_sku || ""),
          amountCents: Number(order.amount_cents) || null,
          pathname: MEMORIES_SUCCESS_ROUTE,
        });
        trackMemoriesEvent({
          eventName: "memories_checkout_completed",
          product: String(order.plan_sku || ""),
          amountCents: Number(order.amount_cents) || null,
          pathname: MEMORIES_SUCCESS_ROUTE,
        });
      }
      setLoading(false);
    }
    void load();
    const t = window.setInterval(() => {
      void load();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [token, mode]);

  async function openPortal() {
    if (!token) return;
    setBusyAction(true);
    try {
      const res = await memoriesApi.billingPortal(token);
      if (res.url) window.location.href = String(res.url);
    } finally {
      setBusyAction(false);
    }
  }

  async function cancelSub() {
    if (!token) return;
    setBusyAction(true);
    try {
      await memoriesApi.cancelSubscription(token);
      trackMemoriesEvent({
        eventName: "memories_subscription_cancelled",
        pathname: MEMORIES_SUCCESS_ROUTE,
      });
      const res = await memoriesApi.orderStatus(token);
      const order = (res.order || {}) as Record<string, unknown>;
      setState((s) => ({
        ...s,
        status: String(order.status || s.status),
      }));
    } finally {
      setBusyAction(false);
    }
  }

  return (
    <>
      <PageHead
        title="Memories — Confirmation"
        description="Your Memories early-access status with The Digital Gifter."
        url="https://www.thedigitalgifter.com/memories/success"
        noindex
      />
      <MemoriesShell>
        <MemoriesSuccessScreen
          loading={loading}
          paymentVerified={state.paymentVerified}
          waitlisted={state.waitlisted}
          planKey={state.planKey}
          status={state.status}
          commercialMode={state.commercialMode}
          onPortal={state.paymentVerified ? openPortal : undefined}
          onCancel={state.paymentVerified ? cancelSub : undefined}
          busyAction={busyAction}
        />
        {!token && !loading ? (
          <p className="px-5 pb-10 text-sm text-[#F4EDE3]/55 sm:px-8">
            Missing order token.{" "}
            <a className="text-[#D4AF7A] underline" href={MEMORIES_ROUTE}>
              Return to Memories
            </a>
          </p>
        ) : null}
      </MemoriesShell>
    </>
  );
}
