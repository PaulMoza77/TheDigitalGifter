import fs from "fs";
import path from "path";
import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { petFunnelEventDevPlugin } from "./vite.petFunnelEventPlugin";
import { petV2DevPlugin } from "./vite.petV2Plugin";
import { christmasV2DevPlugin } from "./vite.christmasPlugin";
import { christmasSeoPrerenderPlugin } from "./vite.christmasSeoPlugin";

function christmasFactory200DevPlugin(): Plugin {
  const root = path.resolve(__dirname, "generated/christmas-factory-200");
  const prefix = "/assets/christmas/christmas-factory-200/";
  const types: Record<string, string> = {
    ".mp4": "video/mp4",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".json": "application/json",
    ".txt": "text/plain; charset=utf-8",
  };
  return {
    name: "christmas-factory-200-dev",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url || "").split("?")[0];
        if (!url.startsWith(prefix)) return next();
        const rel = decodeURIComponent(url.slice(prefix.length));
        const file = path.resolve(root, rel);
        if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
          res.statusCode = 404;
          res.end("not found");
          return;
        }
        const stat = fs.statSync(file);
        const mime = types[path.extname(file).toLowerCase()] || "application/octet-stream";
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Content-Type", mime);
        const range = req.headers.range;
        if (range) {
          const match = /bytes=(\d*)-(\d*)/.exec(range);
          const start = match && match[1] ? Number(match[1]) : 0;
          const end = match && match[2] ? Number(match[2]) : stat.size - 1;
          if (start >= stat.size || end >= stat.size || start > end) {
            res.statusCode = 416;
            res.setHeader("Content-Range", `bytes */${stat.size}`);
            res.end();
            return;
          }
          res.statusCode = 206;
          res.setHeader("Content-Range", `bytes ${start}-${end}/${stat.size}`);
          res.setHeader("Content-Length", String(end - start + 1));
          fs.createReadStream(file, { start, end }).pipe(res);
          return;
        }
        res.setHeader("Content-Length", String(stat.size));
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  process.env.SUPABASE_URL ||= env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  process.env.SUPABASE_SERVICE_ROLE_KEY ||= env.SUPABASE_SERVICE_ROLE_KEY || "";
  process.env.VITE_SUPABASE_URL ||= env.VITE_SUPABASE_URL || "";
  process.env.REPLICATE_API_TOKEN ||= env.REPLICATE_API_TOKEN || "";
  process.env.PET_V2_PREVIEW_LIVE ||= env.PET_V2_PREVIEW_LIVE || "";
  return {
    plugins: [
      react(),
      petFunnelEventDevPlugin(),
      petV2DevPlugin(),
      christmasV2DevPlugin(),
      christmasSeoPrerenderPlugin(),
      christmasFactory200DevPlugin(),
    ],
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
