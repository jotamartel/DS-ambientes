import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { errorResponse } from "~/api-helpers.server";
import { customerActor } from "~/shopify-integration/actor.server";
import { searchProducts } from "~/shopify-integration/products.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const actor = customerActor(request);
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length === 0) return json({ results: [] });
    const results = await searchProducts(actor.shop, q, 10);
    return json({ results });
  } catch (err) {
    return errorResponse(err);
  }
}
