import { ProjectsError } from "~/services/types";
import { variantNumericId } from "./products.server";

export type CartLineInput = {
  variantId: string; // GID
  quantity: number;
};

/**
 * Build a Shopify cart permalink that adds all lines and redirects to
 * checkout. Format: <shop>/cart/<vid>:<qty>,<vid>:<qty>?return_to=/checkout
 *
 * No Storefront API needed. Trade-off: per-line attributes (notes) are not
 * supported by the permalink, only cart-wide attributes via
 * ?attributes[Key]=Value.
 *
 * Reference: https://shopify.dev/docs/api/storefront/2024-04/objects/Cart#cart-permalinks
 */
export function buildCartPermalink(
  shop: string,
  lines: CartLineInput[],
  cartAttributes: Record<string, string> = {},
): string {
  if (lines.length === 0) {
    throw new ProjectsError("VALIDATION", "Cart must have at least one line");
  }
  const segments = lines.map((l) => `${variantNumericId(l.variantId)}:${l.quantity}`);
  const path = segments.join(",");
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(cartAttributes)) {
    params.set(`attributes[${k}]`, v);
  }
  params.set("return_to", "/checkout");
  return `https://${shop}/cart/${path}?${params.toString()}`;
}
