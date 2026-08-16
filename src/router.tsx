import { QueryClient } from "@tanstack/react-query";
import { createRouter, createHashHistory } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  // On the server / during prerender we must use memory history (there is no
  // window). In the browser (including Capacitor's file:// WebView) we use
  // hash history so routing works with no web server and no HTML5 pushState.
  const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
  // Only the packaged app (file://) needs hash history. On the web we use real
  // URLs so shareable pages (/u/:username, /i/:code) can be server-rendered
  // with their own metadata. On the server, TanStack Start supplies the
  // request-based history; memory history is just a safe fallback.
  const isFileProtocol = isBrowser && window.location.protocol === "file:";
  const history = isFileProtocol ? createHashHistory() : undefined;

  const router = createRouter({
    routeTree,
    context: { queryClient },
    ...(history ? { history } : {}),
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
