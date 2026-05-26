import prisma from "~/db.server";
import { ProjectsError } from "~/services/types";

const STOREFRONT_API_VERSION = "2024-04";
const ADMIN_API_VERSION = "2024-04";
const TOKEN_TITLE = "DS Ambientes Projects";

type StorefrontResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

// Process-level cache: avoid re-fetching the storefront token on every request.
// Cold starts do one Admin API roundtrip; warm invocations reuse this.
const tokenCache = new Map<string, string>();

/**
 * Resolve the Storefront API access token for the given shop.
 *
 * Strategy:
 *  1. SHOPIFY_STOREFRONT_TOKEN env var (override, shortcut)
 *  2. In-memory cache (warm lambdas)
 *  3. List existing tokens via Admin API; reuse if found
 *  4. Create a new token via Admin API
 *
 * Requires that the app has been installed (so we have an admin session
 * in the Prisma Session table) and that scope `unauthenticated_*` is granted
 * (so Shopify allows minting a storefront token for this app).
 */
async function getStorefrontToken(shop: string): Promise<string> {
  const envToken = process.env.SHOPIFY_STOREFRONT_TOKEN;
  if (envToken && envToken.trim().length > 0) return envToken;

  const cached = tokenCache.get(shop);
  if (cached) return cached;

  const session = await prisma.session.findFirst({
    where: { shop },
    orderBy: { id: "desc" },
  });
  if (!session?.accessToken) {
    throw new ProjectsError(
      "INTERNAL",
      `No admin session for ${shop}. Install or reinstall the app first.`,
    );
  }

  const adminGraphqlUrl = `https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
  const adminRestUrl = `https://${shop}/admin/api/${ADMIN_API_VERSION}/storefront_access_tokens.json`;
  const headers = {
    "X-Shopify-Access-Token": session.accessToken,
    "Content-Type": "application/json",
  };

  // 1. List existing tokens via REST (the GraphQL `storefrontAccessTokens`
  //    top-level query was removed in 2023-04; REST is still supported).
  const listRes = await fetch(adminRestUrl, { method: "GET", headers });
  if (!listRes.ok) {
    throw new ProjectsError(
      "INTERNAL",
      `Admin REST HTTP ${listRes.status} listing storefront tokens: ${await listRes.text()}`,
    );
  }
  const listData = (await listRes.json()) as {
    storefront_access_tokens?: Array<{ access_token: string; title: string }>;
  };
  const tokens = listData.storefront_access_tokens ?? [];
  const existing = tokens.find((t) => t.title === TOKEN_TITLE) ?? tokens[0];
  if (existing?.access_token) {
    tokenCache.set(shop, existing.access_token);
    return existing.access_token;
  }

  // 2. None exists — create one via GraphQL mutation.
  const createRes = await fetch(adminGraphqlUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      query: /* GraphQL */ `
        mutation CreateStorefrontToken($input: StorefrontAccessTokenInput!) {
          storefrontAccessTokenCreate(input: $input) {
            storefrontAccessToken { accessToken title }
            userErrors { field message }
          }
        }
      `,
      variables: { input: { title: TOKEN_TITLE } },
    }),
  });
  if (!createRes.ok) {
    throw new ProjectsError(
      "INTERNAL",
      `Admin API HTTP ${createRes.status} creating storefront token: ${await createRes.text()}`,
    );
  }
  const createData = (await createRes.json()) as {
    data?: {
      storefrontAccessTokenCreate?: {
        storefrontAccessToken: { accessToken: string } | null;
        userErrors: Array<{ field: string[] | null; message: string }>;
      };
    };
  };
  const created = createData.data?.storefrontAccessTokenCreate;
  const newToken = created?.storefrontAccessToken?.accessToken;
  if (!newToken) {
    const errs = (created?.userErrors ?? []).map((e) => e.message).join("; ");
    throw new ProjectsError(
      "INTERNAL",
      `storefrontAccessTokenCreate returned no token. ${errs || ""}`,
    );
  }
  tokenCache.set(shop, newToken);
  return newToken;
}

export async function storefrontQuery<T>(
  shop: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const token = await getStorefrontToken(shop);
  const url = `https://${shop}/api/${STOREFRONT_API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new ProjectsError(
      "INTERNAL",
      `Storefront API HTTP ${res.status}: ${await res.text()}`,
    );
  }

  const body = (await res.json()) as StorefrontResponse<T>;
  if (body.errors?.length) {
    throw new ProjectsError(
      "INTERNAL",
      `Storefront API errors: ${body.errors.map((e) => e.message).join("; ")}`,
    );
  }
  if (!body.data) {
    throw new ProjectsError("INTERNAL", "Storefront API returned no data");
  }
  return body.data;
}
