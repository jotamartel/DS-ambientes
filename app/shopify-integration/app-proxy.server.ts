import crypto from "node:crypto";
import { ProjectsError } from "~/services/types";

/**
 * Validates the Shopify App Proxy signature on an incoming request.
 *
 * Shopify signs storefront app-proxy requests by HMAC-SHA256ing the sorted
 * non-`signature` query params (concatenated as `key=value` with no separator)
 * with the app's API secret, then attaching the hex digest as `signature`.
 *
 * Reference: https://shopify.dev/docs/apps/build/online-store/display-dynamic-data#calculate-a-digital-signature
 */
export function verifyAppProxySignature(url: URL, apiSecret: string): boolean {
  const signature = url.searchParams.get("signature");
  if (!signature) return false;

  const params: string[] = [];
  url.searchParams.forEach((value, key) => {
    if (key !== "signature") params.push(`${key}=${value}`);
  });
  params.sort();
  const message = params.join("");

  const digest = crypto.createHmac("sha256", apiSecret).update(message).digest("hex");
  if (digest.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

export type AppProxyContext = {
  shop: string;
  customerId: string | null;
  pathPrefix: string;
};

export function authenticateAppProxy(request: Request): AppProxyContext {
  const url = new URL(request.url);

  // Local dev escape hatch: skip signature when explicitly enabled.
  // Useful so the developer can hit /apps/projects directly without going
  // through Shopify's proxy. Never enable in production.
  const bypass = true; // TEMP: hardcoded for local debugging

  if (!bypass) {
    const apiSecret = process.env.SHOPIFY_API_SECRET;
    if (!apiSecret) {
      throw new ProjectsError("INTERNAL", "SHOPIFY_API_SECRET not configured");
    }
    if (!verifyAppProxySignature(url, apiSecret)) {
      throw new ProjectsError("FORBIDDEN", "Invalid app proxy signature");
    }
  }

  const shop = url.searchParams.get("shop") ?? process.env.SHOP;
  if (!shop) throw new ProjectsError("FORBIDDEN", "Missing shop");

  const rawCustomerId = url.searchParams.get("logged_in_customer_id");
  const customerId =
    rawCustomerId && rawCustomerId.trim().length > 0
      ? `gid://shopify/Customer/${rawCustomerId}`
      : bypass && process.env.DEV_CUSTOMER_ID
        ? `gid://shopify/Customer/${process.env.DEV_CUSTOMER_ID}`
        : null;

  return {
    shop,
    customerId,
    pathPrefix: url.searchParams.get("path_prefix") ?? "",
  };
}

export function authenticateAppProxyCustomer(
  request: Request,
): AppProxyContext & { customerId: string } {
  const ctx = authenticateAppProxy(request);
  if (!ctx.customerId) {
    throw new ProjectsError("FORBIDDEN", "Customer must be logged in");
  }
  return ctx as AppProxyContext & { customerId: string };
}
