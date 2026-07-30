// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { queryClient } from "./data";
import { getPublicSupabaseConfig } from "@/lib/env";

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

injectSupabasePreconnect();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
