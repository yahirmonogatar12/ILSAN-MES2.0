import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Only the frontend development server sees this URL. No database secrets.
  const target = env.MES_API_TARGET || "http://127.0.0.1:5000";
  const original = {
    target,
    changeOrigin: true,
    cookieDomainRewrite: "",
  };
  const backend = {
    ...original,
    rewrite: (path: string) => path.replace(/^\/backend/, ""),
  };
  const proxy = {
    "/backend": backend,
    "/portal-tickets": original,
    "/calendario": original,
    "/defect-management": original,
    "/static": original,
    "/api/tickets": original,
  };
  return {
    plugins: [react()],
    cacheDir: "node_modules/.vite-dev",
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: { port: 5174, strictPort: true, proxy },
    preview: { port: 4174, strictPort: true, proxy },
    build: { sourcemap: false },
  };
});
