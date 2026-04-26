import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // VITE_API_BASE_URL overrides at runtime — defaults match the backend
  // smoke-test convention (port 8001 because 8000 was occupied on dev box).
  const apiBase = env.VITE_API_BASE_URL || "http://127.0.0.1:8001";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        "/api": {
          target: apiBase,
          changeOrigin: true,
        },
      },
    },
  };
});
