import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { QueryClientProvider } from "@tanstack/react-query";

import App from "./App";
import { queryClient } from "./data";

// Make sure this environment variable is set in .env.local
const convexUrl = import.meta.env.VITE_CONVEX_URL;
if (!convexUrl) {
  console.error("❌ Missing VITE_CONVEX_URL");
}

// Initialize Convex client
const convex = new ConvexReactClient(convexUrl);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ConvexProvider client={convex}>
        <ConvexAuthProvider client={convex}>
          <App />
        </ConvexAuthProvider>
      </ConvexProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
