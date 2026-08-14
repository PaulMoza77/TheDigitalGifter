import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getPublicSupabaseConfig } from "@/lib/env";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { productTruth } from "@/config/productTruth";
import { productModel } from "@/config/productModel";
import { readOrderAccessToken } from "@/lib/orderAccess";
import {
  RefreshCw,
  Sparkles,
  Download,
  ArrowLeft,
  Home,
  LayoutDashboard,
  Plus,
} from "lucide-react";

const HOME_ROUTE = "/";
const DASHBOARD_ROUTE = "/account/dashboard";
const NEW_GIFT_ROUTE = "/funnel/uploadPhoto";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

type EdgeJson = {
  error?: string;
  message?: string;
  image_url?: string | null;
  order_id?: string;
  generation_id?: string;
  order_status?: string;
  generation_status?: string;
  regenerations_used?: number;
  regenerations_allowed?: number;
};

async function getEdgeFunctionHeaders(anonKey: string): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    apikey: anonKey,
    Authorization: `Bearer ${session?.access_token?.trim() || anonKey}`,
  };
}

async function safeReadJson(res: Response): Promise<EdgeJson> {
  try {
    return (await res.json()) as EdgeJson;
  } catch {
    return {};
  }
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test((value || "").trim());
}

function isTerminalFailure(status: string | null) {
  const s = String(status || "").trim().toLowerCase();
  return ["failed", "error", "canceled", "cancelled", "dead"].includes(s);
}

export default function ResultPage() {
  const q = useQuery();
  const navigate = useNavigate();

  const generationId = String(q.get("generation_id") || q.get("id") || "").trim();
  const orderId = String(q.get("order_id") || "").trim();
  const accessToken = readOrderAccessToken(orderId);

  const [loading, setLoading] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [includedRegenLoading, setIncludedRegenLoading] = useState(false);
  const [regenUsed, setRegenUsed] = useState<number>(0);
  const [regenAllowed, setRegenAllowed] = useState<number>(
    productModel.includedRegenerations,
  );
  const [resolvedOrderId, setResolvedOrderId] = useState(orderId);
  const [generationStatus, setGenerationStatus] = useState("waiting");
  const [unauthorized, setUnauthorized] = useState(false);

  const pageBg = useMemo(() => ({ background: "#f6f1ea" as const }), []);
  const canOpen = Boolean(orderId || generationId);

  async function fetchSignedResult() {
    const { url: supabaseUrl, anon } = getPublicSupabaseConfig();
    const headers = await getEdgeFunctionHeaders(anon);
    const res = await fetch(`${supabaseUrl}/functions/v1/get-signed-result`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        generation_id: generationId || null,
        order_id: orderId || resolvedOrderId || null,
        access_token: accessToken || null,
      }),
    });
    const data = await safeReadJson(res);
    if (res.status === 401) {
      setUnauthorized(true);
      throw new Error("Unauthorized");
    }
    if (!res.ok) {
      throw new Error(String(data.error || data.message || "Could not load result"));
    }
    return data;
  }

  useEffect(() => {
    localStorage.removeItem("tdg_order_access_token");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!canOpen) {
        setLoading(false);
        setErrorMessage("Missing order or generation id.");
        return;
      }

      const start = Date.now();
      const maxMs = 180000;
      setLoading(true);
      setErrorMessage("");
      setUnauthorized(false);

      while (!cancelled && Date.now() - start < maxMs) {
        try {
          const signed = await fetchSignedResult();
          if (cancelled) return;
          if (signed.order_id) setResolvedOrderId(String(signed.order_id));
          if (typeof signed.regenerations_used === "number") setRegenUsed(signed.regenerations_used);
          if (typeof signed.regenerations_allowed === "number") {
            setRegenAllowed(signed.regenerations_allowed);
          }
          setGenerationStatus(String(signed.generation_status || signed.order_status || "waiting"));
          if (signed.image_url && isHttpUrl(signed.image_url)) {
            setImageUrl(signed.image_url);
            setErrorMessage("");
            setLoading(false);
            return;
          }
          if (isTerminalFailure(signed.generation_status || signed.order_status || null)) {
            setErrorMessage(String(signed.error || "Generation failed."));
            setLoading(false);
            return;
          }
        } catch (error) {
          if (cancelled) return;
          const message = error instanceof Error ? error.message : "Could not load result";
          if (message === "Unauthorized") {
            setUnauthorized(true);
            setLoading(false);
            setErrorMessage("You do not have access to this result.");
            return;
          }
          setErrorMessage(message);
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }

      if (!cancelled) {
        setLoading(false);
        if (!errorMessage) setErrorMessage("Still waiting for your image. Refresh to check again.");
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, generationId, accessToken]);

  async function handleIncludedRegeneration() {
    const id = resolvedOrderId || orderId;
    if (!id) {
      toast.error("Missing order. Refresh this page from your payment email.");
      return;
    }
    if (regenUsed >= regenAllowed) {
      toast.error("The included regeneration has already been used.");
      return;
    }

    setIncludedRegenLoading(true);
    try {
      const { url: supabaseUrl, anon } = getPublicSupabaseConfig();
      const headers = await getEdgeFunctionHeaders(anon);
      const res = await fetch(`${supabaseUrl}/functions/v1/request-included-regeneration`, {
        method: "POST",
        headers,
        body: JSON.stringify({ order_id: id, access_token: accessToken || null }),
      });
      const data = await safeReadJson(res);
      if (!res.ok) {
        throw new Error(String(data.error || data.message || "Regeneration failed"));
      }
      toast.success("Creating a new image. This page will update when it is ready.");
      window.location.reload();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Regeneration failed");
    } finally {
      setIncludedRegenLoading(false);
    }
  }

  function downloadCurrent() {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (!canOpen || unauthorized) {
    return (
      <div className="min-h-screen" style={pageBg}>
        <header className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" className="text-zinc-700 hover:text-zinc-900" onClick={() => navigate(HOME_ROUTE)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div className="select-none text-lg font-semibold tracking-wide text-[#0b3b2e] sm:text-xl">
              TheDigitalGifter
            </div>
            <div className="text-sm text-zinc-600">3 of 3</div>
          </div>
          <div className="mt-4">
            <Separator className="bg-zinc-200" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6">
          <Card className="border-zinc-200 bg-white/80 shadow-sm">
            <CardContent className="p-8 text-center">
              <h1 className="text-3xl font-semibold text-[#0b3b2e] sm:text-4xl">
                We couldn’t open your result
              </h1>
              <p className="mt-3 text-zinc-700">
                {unauthorized
                  ? "This result is private. Open it from your payment email or while signed in to the same account."
                  : "The order id is missing. Please return and try again."}
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button onClick={() => navigate(NEW_GIFT_ROUTE)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Start again
                </Button>
                <Button variant="outline" onClick={() => navigate(HOME_ROUTE)}>
                  <Home className="mr-2 h-4 w-4" />
                  Go home
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={pageBg}>
      <header className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 sm:pt-6">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" className="text-zinc-700 hover:text-zinc-900" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div className="select-none text-lg font-semibold tracking-wide text-[#0b3b2e] sm:text-xl">
            TheDigitalGifter
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="hidden text-zinc-700 hover:text-zinc-900 sm:inline-flex" onClick={() => navigate(HOME_ROUTE)}>
              <Home className="mr-2 h-4 w-4" />
              Home
            </Button>
            <Button variant="ghost" className="hidden text-zinc-700 hover:text-zinc-900 sm:inline-flex" onClick={() => navigate(DASHBOARD_ROUTE)}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
            <div className="text-sm text-zinc-600">3 of 3</div>
          </div>
        </div>
        <div className="mt-4">
          <Separator className="bg-zinc-200" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="text-center">
          <Badge variant="outline" className="border-[#0b3b2e]/15 bg-white/70 px-3 py-1 text-[#0b3b2e]">
            {productTruth.copy.aiGeneratedDisclosure}
          </Badge>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#0b3b2e] sm:text-4xl md:text-5xl">
            {imageUrl
              ? "Your gift is ready"
              : loading
                ? "Finishing your gift…"
                : generationStatus === "failed"
                  ? "Generation failed"
                  : "Almost there…"}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-zinc-700 sm:text-base md:text-lg">
            {imageUrl
              ? "Download your gift or create another one."
              : "This page will update when the image is ready."}
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_.85fr]">
          <Card className="overflow-hidden border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(17,24,39,0.08)]">
            <CardContent className="p-4 sm:p-5">
              <div className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white">
                {imageUrl ? (
                  <>
                    <img src={imageUrl} alt="Final result" className="block h-auto w-full object-contain" />
                    <button
                      type="button"
                      onClick={() => void handleIncludedRegeneration()}
                      disabled={includedRegenLoading || regenUsed >= regenAllowed}
                      className="absolute right-3 top-3 inline-flex items-center rounded-full bg-[#0b3b2e] px-3 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-[#082c22] disabled:cursor-not-allowed disabled:opacity-60 sm:right-4 sm:top-4"
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      {includedRegenLoading
                        ? "Loading..."
                        : regenUsed >= regenAllowed
                          ? "Regeneration used"
                          : "Included regeneration"}
                    </button>
                  </>
                ) : (
                  <div className="flex min-h-[340px] items-center justify-center bg-gradient-to-b from-white to-[#f7f3ee] px-6 py-12 text-center sm:min-h-[420px]">
                    <div>
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-zinc-200 bg-white">
                        <RefreshCw className={`h-5 w-5 text-[#0b3b2e] ${loading ? "animate-spin" : ""}`} />
                      </div>
                      <div className="mt-4 text-base font-medium text-zinc-900">
                        {loading ? "Generating your final image…" : "Result not ready yet"}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button className="bg-[#0b3b2e] text-white hover:bg-[#082c22]" onClick={downloadCurrent} disabled={!imageUrl}>
                  <Download className="mr-2 h-4 w-4" />
                  Download image
                </Button>
                <Button variant="outline" onClick={() => navigate(NEW_GIFT_ROUTE)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create another gift
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>

              {errorMessage ? (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-700">
                  {errorMessage}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 bg-white/85 shadow-[0_10px_40px_rgba(17,24,39,0.08)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-2xl text-[#0b3b2e]">Your purchase</CardTitle>
              <CardDescription className="text-zinc-600">
                {productModel.displayPrice} still image · personal use · one included regeneration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm leading-6 text-zinc-700">
                This image is {productTruth.copy.aiGeneratedDisclosure.toLowerCase()}.{" "}
                {productTruth.copy.licenseSentence} Uploads are kept 24 hours and results 30 days.
              </div>
              <Button
                className="w-full bg-[#0b3b2e] text-white hover:bg-[#082c22]"
                onClick={() => void handleIncludedRegeneration()}
                disabled={includedRegenLoading || regenUsed >= regenAllowed || !imageUrl}
              >
                {includedRegenLoading
                  ? "Starting…"
                  : regenUsed >= regenAllowed
                    ? "Included regeneration used"
                    : "Use included regeneration"}
              </Button>
              <p className="text-xs leading-5 text-zinc-500">
                Generation starts only after Stripe confirms payment. Refreshing this page does not
                charge you again and does not start a second generation.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
