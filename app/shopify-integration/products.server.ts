import { storefrontQuery } from "./storefront.server";

const USD_METAFIELD_NAMESPACE = process.env.USD_METAFIELD_NAMESPACE ?? "ds-forma";
const USD_METAFIELD_KEY = process.env.USD_METAFIELD_KEY ?? "variant_price_usd_iva";

// Coverage per unit, in m². Purely informational: shown so the customer knows
// how much area one box covers. It does NOT drive the quantity.
const RENDIMIENTO_METAFIELD_NAMESPACE =
  process.env.RENDIMIENTO_METAFIELD_NAMESPACE ?? "calc";
const RENDIMIENTO_METAFIELD_KEY =
  process.env.RENDIMIENTO_METAFIELD_KEY ?? "rendimiento_m2";

// The unit the product is actually sold in. When it reads "m2" the quantity a
// customer enters *is* an area, so we ask for square metres instead of units.
const USAGE_UNIT_METAFIELD_NAMESPACE =
  process.env.USAGE_UNIT_METAFIELD_NAMESPACE ?? "ds-forma";
const USAGE_UNIT_METAFIELD_KEY =
  process.env.USAGE_UNIT_METAFIELD_KEY ?? "usage_unit";

// Product-level list of product references pointing at the adhesive a floor
// needs. Only ~2/3 of the m²-sold catalogue has it filled in, so every consumer
// must tolerate its absence.
const PEGAMENTO_LINK_NAMESPACE =
  process.env.PEGAMENTO_LINK_NAMESPACE ?? "calc";
const PEGAMENTO_LINK_KEY =
  process.env.PEGAMENTO_LINK_KEY ?? "relacionados_calculadora_lista";

// Variant-level: how many m² one bag of adhesive covers.
const PEGAMENTO_RENDIMIENTO_NAMESPACE =
  process.env.PEGAMENTO_RENDIMIENTO_NAMESPACE ?? "calc";
const PEGAMENTO_RENDIMIENTO_KEY =
  process.env.PEGAMENTO_RENDIMIENTO_KEY ?? "rendimiento_pegamento";

export type Money = { amount: string; currencyCode: string };

/**
 * The adhesive a floor product points at, with the coverage needed to work out
 * how many bags a given area takes.
 */
export type Pegamento = {
  variantId: string;
  productId: string;
  productTitle: string;
  productHandle: string;
  variantTitle: string | null;
  price: Money;
  priceUsd: Money | null;
  available: boolean;
  imageUrl: string | null;
  // m² covered by one bag.
  rendimientoM2: number;
};

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
  // Normalized lowercase, e.g. "m2". null when the metafield is absent.
  usageUnit: string | null;
  // Adhesive this product needs. null when unlinked or missing coverage.
  pegamento: Pegamento | null;
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
    usageUnit: string | null;
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

/**
 * Pick the adhesive to suggest out of one link's products.
 *
 * The link is a list and each product may have several bag sizes, so we take
 * the first variant that actually declares a coverage — anything without one
 * cannot be turned into a bag count and is useless as a suggestion.
 */
function pegamentoFromLink(link: RawPegamentoLink | undefined): Pegamento | null {
  const linked = link?.references?.nodes ?? [];
  for (const product of linked) {
    for (const variant of product.variants?.nodes ?? []) {
      const rendimiento = parseRendimiento(variant.rendimientoPegamento?.value);
      if (rendimiento == null || !variant.price) continue;
      const usdValue = parseDecimal(variant.usdMetafield?.value);
      return {
        variantId: variant.id,
        productId: product.id,
        productTitle: product.title,
        productHandle: product.handle,
        variantTitle: variant.title === "Default Title" ? null : (variant.title ?? null),
        price: variant.price,
        priceUsd: usdValue ? { amount: usdValue, currencyCode: "USD" } : null,
        available: variant.availableForSale !== false,
        imageUrl: variant.image?.url ?? product.featuredImage?.url ?? null,
        rendimientoM2: rendimiento,
      };
    }
  }
  return null;
}

/**
 * Resolve the adhesive for a variant, checking the variant's own link before
 * the parent product's.
 *
 * The link started out as a product-level metafield, but a handful of products
 * have variants that need different adhesives — a 15x15 and a 61xLL of the same
 * travertino do not take the same glue. Reading the variant first lets those be
 * overridden one by one while everything already loaded on the parent keeps
 * working untouched. See DSA-359.
 */
function resolvePegamento(node: NonNullable<RawVariantNode>): Pegamento | null {
  return (
    pegamentoFromLink(node.pegamentoLink) ??
    pegamentoFromLink(node.product?.pegamentoLink)
  );
}

/**
 * Normalize the usage unit so "M2", "m2" and " m² " all compare equal.
 * The superscript ² is folded to a plain 2.
 */
function parseUsageUnit(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const v = String(raw).trim().toLowerCase().replace(/²/g, "2");
  return v.length > 0 ? v : null;
}

/**
 * The adhesive link resolves to whole products, each with its own bag sizes.
 * Shared because the link is read at two levels — see resolvePegamento.
 */
const PEGAMENTO_LINK_SELECTION = /* GraphQL */ `
  references(first: 5) {
    nodes {
      ... on Product {
        id
        title
        handle
        featuredImage { url }
        variants(first: 10) {
          nodes {
            id
            title
            availableForSale
            price { amount currencyCode }
            image { url }
            rendimientoPegamento: metafield(namespace: "${PEGAMENTO_RENDIMIENTO_NAMESPACE}", key: "${PEGAMENTO_RENDIMIENTO_KEY}") {
              value
            }
            usdMetafield: metafield(namespace: "${USD_METAFIELD_NAMESPACE}", key: "${USD_METAFIELD_KEY}") {
              value
            }
          }
        }
      }
    }
  }
`;

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
          usageUnitMetafield: metafield(namespace: "${USAGE_UNIT_METAFIELD_NAMESPACE}", key: "${USAGE_UNIT_METAFIELD_KEY}") {
            value
          }
          pegamentoLink: metafield(namespace: "${PEGAMENTO_LINK_NAMESPACE}", key: "${PEGAMENTO_LINK_KEY}") {
            ${PEGAMENTO_LINK_SELECTION}
          }
        }
        usageUnitMetafield: metafield(namespace: "${USAGE_UNIT_METAFIELD_NAMESPACE}", key: "${USAGE_UNIT_METAFIELD_KEY}") {
          value
        }
        pegamentoLink: metafield(namespace: "${PEGAMENTO_LINK_NAMESPACE}", key: "${PEGAMENTO_LINK_KEY}") {
          ${PEGAMENTO_LINK_SELECTION}
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

type RawPegamentoLink = {
  references?: {
    nodes: Array<{
      id: string;
      title: string;
      handle: string;
      featuredImage?: { url: string } | null;
      variants: {
        nodes: Array<{
          id: string;
          title?: string | null;
          availableForSale?: boolean;
          price: Money;
          image?: { url: string } | null;
          rendimientoPegamento?: { value: string } | null;
          usdMetafield?: { value: string } | null;
        }>;
      };
    }>;
  } | null;
} | null;

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
    usageUnitMetafield?: { value: string } | null;
    pegamentoLink?: RawPegamentoLink;
  };
  usdMetafield?: { value: string; type: string } | null;
  rendimientoMetafield?: { value: string; type: string } | null;
  usageUnitMetafield?: { value: string } | null;
  pegamentoLink?: RawPegamentoLink;
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
        // Defined at product level in the shop, but read variant-first so a
        // per-variant override keeps working if one is ever added.
        usageUnit:
          parseUsageUnit(node.usageUnitMetafield?.value) ??
          parseUsageUnit(node.product.usageUnitMetafield?.value),
        pegamento: resolvePegamento(node),
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
        usageUnitMetafield: metafield(namespace: "${USAGE_UNIT_METAFIELD_NAMESPACE}", key: "${USAGE_UNIT_METAFIELD_KEY}") {
          value
        }
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
            usageUnitMetafield: metafield(namespace: "${USAGE_UNIT_METAFIELD_NAMESPACE}", key: "${USAGE_UNIT_METAFIELD_KEY}") {
              value
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
        usageUnitMetafield: { value: string } | null;
        variants: {
          nodes: Array<{
            id: string;
            title: string;
            availableForSale: boolean;
            price: Money;
            usdMetafield: { value: string } | null;
            rendimientoMetafield: { value: string } | null;
            usageUnitMetafield: { value: string } | null;
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
        usageUnit:
          parseUsageUnit(v.usageUnitMetafield?.value) ??
          parseUsageUnit(p.usageUnitMetafield?.value),
      };
    }),
  }));
}
