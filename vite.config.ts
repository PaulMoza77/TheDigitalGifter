import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { petFunnelEventDevPlugin } from "./vite.petFunnelEventPlugin";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  process.env.SUPABASE_URL ||= env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= env.SUPABASE_SERVICE_ROLE_KEY || "";
  process.env.VITE_SUPABASE_URL ||= env.VITE_SUPABASE_URL || "";
  return {
    plugins: [react(), petFunnelEventDevPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-motion": ["framer-motion"],
        },
      },
    },
  },
  };
});
