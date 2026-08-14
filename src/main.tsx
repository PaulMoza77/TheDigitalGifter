import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "./data";
import { getPublicSupabaseConfig } from "@/lib/env";
import { captureOrderAccessFromUrl } from "@/lib/orderAccess";

function injectSupabasePreconnect() {
  try {
    const { url } = getPublicSupabaseConfig();
    const origin = new URL(url).origin;
    if (document.querySelector(`link[data-tdg-preconnect='${origin}']`)) return;

    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = origin;
    preconnect.crossOrigin = "anonymous";
    preconnect.setAttribute("data-tdg-preconnect", origin);
    document.head.appendChild(preconnect);

    const dns = document.createElement("link");
    dns.rel = "dns-prefetch";
    dns.href = origin;
    document.head.appendChild(dns);
  } catch {
    // Env validation surfaces when the Supabase client boots.
  }
}

async function redeemResultAccess(orderId: string, code: string): Promise<string | null> {
  try {
    const { url, anon } = getPublicSupabaseConfig();
    const res = await fetch(`${url}/functions/v1/redeem-result-access`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ order_id: orderId, code }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string };
    return String(data.access_token || "").trim() || null;
  } catch {
    return null;
  }
}

injectSupabasePreconnect();

void (async () => {
  await captureOrderAccessFromUrl({ redeem: redeemResultAccess });
  const { default: App } = await import("./App");
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  );
})();
