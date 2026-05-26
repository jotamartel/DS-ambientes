import type { Actor } from "~/services/types";
import {
  authenticateAppProxy,
  authenticateAppProxyCustomer,
} from "./app-proxy.server";

/**
 * Build an Actor for an App Proxy request from a logged-in customer.
 * Throws FORBIDDEN if the signature is invalid or the customer is not logged in.
 */
export function customerActor(request: Request): Actor & { kind: "customer" } {
  const { shop, customerId } = authenticateAppProxyCustomer(request);
  return { kind: "customer", shop, customerId };
}

/**
 * Variant for read-only public-ish App Proxy endpoints where login is optional.
 * Returns null when the visitor is not logged in.
 */
export function maybeCustomerActor(
  request: Request,
): (Actor & { kind: "customer" }) | { shop: string; anonymous: true } {
  const { shop, customerId } = authenticateAppProxy(request);
  if (!customerId) return { shop, anonymous: true };
  return { kind: "customer", shop, customerId };
}
