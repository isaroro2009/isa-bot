// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

// Public web builds need the normal TanStack server output. Capacitor native
// exports can opt into a static hash-routed bundle with `VITE_BASE=./ bun run build`.
const BASE = process.env.VITE_BASE ?? "/";
const isCapacitorBuild = BASE === "./";

export default defineConfig({
  vite: {
    base: BASE,
    plugins: [
      // 📱 App instalable + funciona sin internet.
      // El manifest vive en public/manifest.webmanifest y el registro del
      // service worker lo hace src/lib/pwa-register.ts (nunca en preview/dev).
      VitePWA({
        strategies: "generateSW",
        registerType: "autoUpdate",
        injectRegister: null,
        manifest: false,
        filename: "sw.js",
        devOptions: { enabled: false },
        workbox: {
          globPatterns: ["**/*.{js,css,ico,png,svg,webp,woff,woff2}"],
          // El paquete del cerebro local (~6 MB) no se precachea: se descarga
          // solo cuando la persona lo pide y queda en el caché de runtime.
          globIgnores: ["**/lib-*.js", "**/web-llm*.js"],
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,

          navigateFallback: undefined,
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          runtimeCaching: [
            {
              // Las navegaciones nunca se sirven primero desde caché.
              urlPattern: ({ request, url }) =>
                request.mode === "navigate" &&
                !url.pathname.startsWith("/api/") &&
                !url.pathname.startsWith("/~oauth") &&
                !url.pathname.startsWith("/_serverFn"),
              handler: "NetworkFirst",
              options: {
                cacheName: "isabot-pages",
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 30 },
              },
            },
            {
              urlPattern: ({ url, sameOrigin }) =>
                sameOrigin && /\.(?:js|css|woff2?|png|svg|webp|ico)$/.test(url.pathname),
              handler: "CacheFirst",
              options: {
                cacheName: "isabot-assets",
                expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
        },
      }),
    ],
  },
  tanstackStart: {
    server: { entry: "server" },
    ...(isCapacitorBuild
      ? {
          // SPA mode: prerender a static shell so Capacitor can load the app
          // from the local bundle without needing a server runtime.
          spa: { enabled: true },
        }
      : {}),
  },
  nitro: isCapacitorBuild ? false : undefined,
});
