import { storefrontQuery } from "./storefront.server";

const USD_METAFIELD_NAMESPACE = process.env.USD_METAFIELD_NAMESPACE ?? "ds-forma";
const USD_METAFIELD_KEY = process.env.USD_METAFIELD_KEY ?? "variant_price_usd_iva";

// Coverage per unit, in m². Products that carry it (pisos, revestimientos)
// let the customer shop by area instead of by box.
const RENDIMIENTO_METAFIELD_NAMESPACE =
  process.env.RENDIMIENTO_METAFIELD_NAMESPACE ?? "calc";
const RENDIMIENTO_METAFIELD_KEY =
  process.env.RENDIMIENTO_METAFIELD_KEY ?? "rendimiento_m2";

export type Money = { amount: string; currencyCode: string };

export type LiveVariant = {
  variantId: string;       // GID
  productId: string;       // GID
  productTitle: string;
  productHandle: string;
  variantTitle: string | null;
  price: Money;
  priceUsd: Money | null;
  available: boolean;
  imageUrl: string | null;
  imageAlt: string | null;
  // m² covered per unit. null when the variant has no rendimiento metafield.
  rendimientoM2: number | null;
};

export type ProductSearchHit = {
  productId: string;
  productTitle: string;
  productHandle: string;
  imageUrl: string | null;
  variants: Array<{
    variantId: string;
    variantTitle: string;
    available: boolean;
    price: Money;
    priceUsd: Money | null;
    rendimientoM2: number | null;
  }>;
};

/**
 * Lookups: callers can pass either a bare GID or { variantId, productHandle }.
 * The handle is no longer needed (Storefront API resolves variants directly by
 * GID), but the type is kept for backward compatibility with existing callers.
 */
export type VariantLookup =
  | string
  | { variantId: string; productHandle?: string | null };

export function variantNumericId(variantGid: string): string {
  const m = variantGid.match(/\/ProductVariant\/(\d+)$/);
  return m?.[1] ?? variantGid;
}

function variantIdsFromLookups(variants: VariantLookup[]): string[] {
  const set = new Set<string>();
  for (const v of variants) {
    set.add(typeof v === "string" ? v : v.variantId);
  }
  return Array.from(set);
}

/**
 * Parse a metafield value to a normalized decimal string.
 * Shopify's number_decimal type stores dot-separated values ("746.57"), but
 * raw user-entered metafields may use Spanish-format comma ("746,57"). We
 * detect by presence of comma to avoid stripping dots from the normalized form.
 */
function parseNumeric(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return null;
  const hasComma = trimmed.includes(",");
  // If a comma is present, assume Spanish format: dot=thousands, comma=decimal.
  // Otherwise assume the value is already normalized with dot as decimal.
  const normalized = hasComma
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const num = parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseDecimal(raw: string | null | undefined): string | null {
  const num = parseNumeric(raw);
  return num == null ? null : num.toFixed(2);
}

/**
 * Coverage per unit in m². Zero or negative is treated as absent — it would
 * make the m²→units division meaningless (and blow up as a divisor).
 */
function parseRendimiento(raw: string | null | undefined): number | null {
  const num = parseNumeric(raw);
  return num != null && num > 0 ? num : null;
}

const NODES_QUERY = /* GraphQL */ `
  query VariantsByIds($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on ProductVariant {
        id
        title
        availableForSale
        price { amount currencyCode }
        image { url altText }
        product {
          id
          title
          handle
          featuredImage { url altText }
        }
        usdMetafield: metafield(namespace: "${USD_METAFIELD_NAMESPACE}", key: "${USD_METAFIELD_KEY}") {
          value
          type
        }
        rendimientoMetafield: metafield(namespace: "${RENDIMIENTO_METAFIELD_NAMESPACE}", key: "${RENDIMIENTO_METAFIELD_KEY}") {
          value
          type
        }
      }
    }
  }
`;

type RawVariantNode = {
  id: string;
  title?: string | null;
  availableForSale?: boolean;
  price?: Money;
  image?: { url: string; altText: string | null } | null;
  product?: {
    id: string;
    title: string;
    handle: string;
    featuredImage?: { url: string; altText: string | null } | null;
  };
  usdMetafield?: { value: string; type: string } | null;
  rendimientoMetafield?: { value: string; type: string } | null;
} | null;

/**
 * Fetch live data for a batch of variant GIDs via Storefront API.
 * Includes the USD price metafield when present.
 */
export async function fetchVariantsLive(
  shop: string,
  variants: VariantLookup[],
): Promise<Map<string, LiveVariant | null>> {
  const result = new Map<string, LiveVariant | null>();
  if (variants.length === 0) return result;

  const ids = variantIdsFromLookups(variants);
  // Storefront API allows up to 250 nodes per query; chunk to be safe.
  const CHUNK = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

  const responses = await Promise.all(
    chunks.map((chunk) =>
      storefrontQuery<{ nodes: RawVariantNode[] }>(shop, NODES_QUERY, { ids: chunk }),
    ),
  );

  // Map by requested ID. Storefront returns one node per requested id (null when not found).
  let cursor = 0;
  for (const resp of responses) {
    for (const node of resp.nodes) {
      const requestedId = ids[cursor++];
      if (!node || !node.product || !node.price) {
        result.set(requestedId, null);
        continue;
      }
      const image = node.image ?? node.product.featuredImage ?? null;
      const usdValue = parseDecimal(node.usdMetafield?.value);
      result.set(node.id, {
        variantId: node.id,
        productId: node.product.id,
        productTitle: node.product.title,
        productHandle: node.product.handle,
        variantTitle: node.title === "Default Title" ? null : (node.title ?? null),
        price: node.price,
        priceUsd: usdValue ? { amount: usdValue, currencyCode: "USD" } : null,
        available: node.availableForSale !== false,
        imageUrl: image?.url ?? null,
        imageAlt: image?.altText ?? null,
        rendimientoM2: parseRendimiento(node.rendimientoMetafield?.value),
      });
    }
  }

  // Fill anything still missing with null.
  for (const id of ids) {
    if (!result.has(id)) result.set(id, null);
  }
  return result;
}

const PRODUCT_SEARCH_QUERY = /* GraphQL */ `
  query ProductSearch($query: String!, $first: Int!) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        handle
        featuredImage { url altText }
        variants(first: 20) {
          nodes {
            id
            title
            availableForSale
            price { amount currencyCode }
            usdMetafield: metafield(namespace: "${USD_METAFIELD_NAMESPACE}", key: "${USD_METAFIELD_KEY}") {
              value
              type
            }
            rendimientoMetafield: metafield(namespace: "${RENDIMIENTO_METAFIELD_NAMESPACE}", key: "${RENDIMIENTO_METAFIELD_KEY}") {
              value
              type
            }
          }
        }
      }
    }
  }
`;

export async function searchProducts(
  shop: string,
  query: string,
  limit = 10,
): Promise<ProductSearchHit[]> {
  const data = await storefrontQuery<{
    products: {
      nodes: Array<{
        id: string;
        title: string;
        handle: string;
        featuredImage: { url: string; altText: string | null } | null;
        variants: {
          nodes: Array<{
            id: string;
            title: string;
            availableForSale: boolean;
            price: Money;
            usdMetafield: { value: string } | null;
            rendimientoMetafield: { value: string } | null;
          }>;
        };
      }>;
    };
  }>(shop, PRODUCT_SEARCH_QUERY, { query, first: limit });

  return data.products.nodes.map((p) => ({
    productId: p.id,
    productTitle: p.title,
    productHandle: p.handle,
    imageUrl: p.featuredImage?.url ?? null,
    variants: p.variants.nodes.map((v) => {
      const usdValue = parseDecimal(v.usdMetafield?.value);
      return {
        variantId: v.id,
        variantTitle: v.title,
        available: v.availableForSale !== false,
        price: v.price,
        priceUsd: usdValue ? { amount: usdValue, currencyCode: "USD" } : null,
        rendimientoM2: parseRendimiento(v.rendimientoMetafield?.value),
      };
    }),
  }));
}
