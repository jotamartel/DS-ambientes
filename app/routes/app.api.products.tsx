import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { searchProducts, getProductVariants } from "../services/shopify.api.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const query = url.searchParams.get("query") || "";
  const variantIds = url.searchParams.get("variantIds");

  try {
    if (variantIds) {
      // Fetch specific variants (for refreshing prices)
      const ids = variantIds.split(",");
      const variants = await getProductVariants(admin, ids);
      return json({ variants });
    }

    // Search products
    const products = await searchProducts(admin, query, 20);
    return json({ products });
  } catch (error) {
    console.error("Error fetching products:", error);
    return json({ error: "Error al obtener productos" }, { status: 500 });
  }
};
