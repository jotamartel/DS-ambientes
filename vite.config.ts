import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig, type UserConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Note: v3_singleFetch is intentionally OFF. With singleFetch enabled,
// Remix's client navigation fetches loader data from `/<route>.data`
// URLs. Under our App Proxy setup, those URLs aren't always proxied
// cleanly by Shopify (some 404), breaking SPA navigation. Without it,
// Remix uses query params (?_data=...) on the same path, which is
// safer for App Proxy.

if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(
  process.env.SHOPIFY_APP_URL || "http://localhost"
).hostname;

let hmrConfig;
if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT!) || 8002,
    clientPort: 443,
  };
}

// When the storefront serves our pages via App Proxy, they live on
// dsforma.com.ar/apps/projects/... — but Shopify only proxies that one
// path, NOT /assets/*. So relative asset URLs (default: /assets/foo.js)
// would 404 on the storefront. By setting `base` to the absolute public
// URL of the deployed app, all asset tags become absolute and the browser
// fetches them straight from Vercel, bypassing the proxy.
const assetBase =
  process.env.PUBLIC_ASSET_URL ??
  process.env.SHOPIFY_APP_URL ??
  "/";
const normalizedBase = assetBase.endsWith("/") ? assetBase : `${assetBase}/`;

export default defineConfig({
  base: normalizedBase,
  server: {
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    remix({
      ignoredRouteFiles: ["**/.*"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        // Disabled: lazy discovery fetches route manifest entries on demand,
        // which fails behind App Proxy when those URLs aren't matched cleanly.
        // We ship the full manifest upfront instead.
        v3_lazyRouteDiscovery: false,
        v3_singleFetch: false,
        v3_routeConfig: false,
      },
    }),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
}) satisfies UserConfig;
