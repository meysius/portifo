import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = env.VITE_API_URL || "http://localhost:3000";

  return {
    plugins: [react()],
    // The commit a build was made from (GitHub Actions sets GITHUB_SHA), so a
    // report from a device can say which deploy it came from.
    define: {
      __BUILD__: JSON.stringify((process.env.GITHUB_SHA ?? "dev").slice(0, 7)),
    },
    server: {
      host: true,
      port: 5173,
      // LAN devices (phones) need to load this to test touch/swipe gestures
      // and the iOS PWA install flow, and Vite blocks unrecognized Host
      // headers by default as a security measure.
      allowedHosts: true,
      proxy: {
        "/users": { target: apiTarget, changeOrigin: true },
        "/auth": { target: apiTarget, changeOrigin: true },
        "/accounts": { target: apiTarget, changeOrigin: true },
        "/transactions": { target: apiTarget, changeOrigin: true },
        "/portfolio": { target: apiTarget, changeOrigin: true },
        "/market": { target: apiTarget, changeOrigin: true },
        "/push": { target: apiTarget, changeOrigin: true },
      },
    },
  };
});
