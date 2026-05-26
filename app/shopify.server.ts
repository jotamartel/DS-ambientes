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
const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.April24,
  scopes: (process.env.SCOPES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
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
