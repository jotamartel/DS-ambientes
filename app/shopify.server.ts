import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

/**
 * Minimal Shopify app config used ONLY to handle the OAuth install flow.
 * We don't render an embedded admin UI; this exists so that Shopify can
 * complete `install → grant access → redirect back` cleanly when a merchant
 * adds the app via custom distribution. Once installed, App Proxy verification
 * is handled by app/shopify-integration/app-proxy.server.ts (independent of
 * this).
 */
/**
 * Scopes requested during OAuth. These MUST stay in sync with `access_scopes`
 * in shopify.app.toml — Shopify grants what the OAuth request asks for, and a
 * scope that only exists in the toml is never actually granted.
 *
 * This lived in the SCOPES env var alone, which drifted from the toml and
 * silently broke file uploads: the token was issued without `write_files`, so
 * every stagedUploadsCreate call came back "Access denied". Keeping the list in
 * the repo means a mismatch shows up in a diff. The env var still wins when
 * set, so an operator can adjust without a deploy.
 */
const DEFAULT_SCOPES = [
  "read_products",
  "unauthenticated_read_product_listings",
  "write_files",
];

const scopes = (process.env.SCOPES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.April24,
  scopes: scopes.length > 0 ? scopes : DEFAULT_SCOPES,
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.SingleMerchant,
  isEmbeddedApp: false,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
  },
});

export default shopify;
export const authenticate = shopify.authenticate;
export const login = shopify.login;
export const sessionStorage = shopify.sessionStorage;
