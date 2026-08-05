import prisma from "~/db.server";
import { ProjectsError } from "~/services/types";

const ADMIN_API_VERSION = "2024-04";

type AdminResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

async function getAdminToken(shop: string): Promise<string> {
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
  return session.accessToken;
}

export async function adminGraphqlQuery<T>(
  shop: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const token = await getAdminToken(shop);
  const url = `https://${shop}/admin/api/${ADMIN_API_VERSION}/graphql.json`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    throw new ProjectsError(
      "INTERNAL",
      `Admin API HTTP ${res.status}: ${await res.text()}`,
    );
  }

  const body = (await res.json()) as AdminResponse<T>;
  if (body.errors?.length) {
    const detail = body.errors.map((e) => e.message).join("; ");
    // "Access denied for <field>" means the stored token was issued without
    // the scope that field needs — adding it to the config is not enough, the
    // app has to be re-authorized so Shopify mints a new token. Say so instead
    // of surfacing a bare 500 that tells nobody anything.
    if (/access denied/i.test(detail)) {
      throw new ProjectsError(
        "INTERNAL",
        `La app no tiene permisos suficientes en Shopify (${detail}). ` +
          `Hay que reautorizarla para que se emita un token con los scopes actuales.`,
      );
    }
    throw new ProjectsError("INTERNAL", `Admin API errors: ${detail}`);
  }
  if (!body.data) {
    throw new ProjectsError("INTERNAL", "Admin API returned no data");
  }
  return body.data;
}
