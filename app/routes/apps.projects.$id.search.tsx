import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { CustomerLayout, Empty } from "~/customer-ui/Layout";
import { customerActor } from "~/shopify-integration/actor.server";
import { searchProducts } from "~/shopify-integration/products.server";
import { addItem } from "~/services/item.server";
import { assertEnvironmentOwned } from "~/services/scope.server";
import { ProjectsError } from "~/services/types";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const actor = customerActor(request);
  const projectId = params.id!;
  const url = new URL(request.url);
  const envId = url.searchParams.get("env") ?? "";
  const q = url.searchParams.get("q") ?? "";
  await assertEnvironmentOwned(actor, envId);
  const results = q.trim().length > 0 ? await searchProducts(actor.shop, q.trim(), 10) : [];
  return json({ projectId, envId, q, results });
}

const AddSchema = z.object({
  environmentId: z.string().min(1),
  productId: z.string().min(1),
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(9999).default(1),
});

export async function action({ request, params }: ActionFunctionArgs) {
  const actor = customerActor(request);
  const projectId = params.id!;
  const formData = await request.formData();
  const parsed = AddSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? "Input inválido" }, { status: 400 });
  try {
    await addItem(actor, parsed.data.environmentId, {
      productId: parsed.data.productId,
      variantId: parsed.data.variantId,
      quantity: parsed.data.quantity,
    });
  } catch (err) {
    if (err instanceof ProjectsError) {
      return json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  return redirect(`/apps/projects/${projectId}`);
}

export default function ProductSearch() {
  const { projectId, envId, q, results } = useLoaderData<typeof loader>();

  return (
    <CustomerLayout
      title="Agregar producto"
      back={{ to: `/apps/projects/${projectId}`, label: "Volver al proyecto" }}
    >
      <Form method="get" className="cu-card cu-row" reloadDocument>
        <input type="hidden" name="env" value={envId} />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar productos..."
          className="cu-input"
          style={{ flex: 1 }}
        />
        <button type="submit" className="cu-btn">Buscar</button>
      </Form>

      {q.trim().length === 0 ? (
        <Empty message="Escribí lo que estás buscando." />
      ) : results.length === 0 ? (
        <Empty message="Sin resultados." />
      ) : (
        <div className="cu-stack">
          {results.map((p) => (
            <article key={p.productId} className="cu-card">
              <div className="cu-product">
                {p.imageUrl ? <img src={p.imageUrl} alt="" className="cu-product-img" /> : <div className="cu-product-img" />}
                <div className="cu-product-info">
                  <p className="cu-product-title">{p.productTitle}</p>
                </div>
              </div>
              <div className="cu-stack" style={{ marginTop: 8 }}>
                {p.variants.map((v) => (
                  <Form
                    method="post"
                    reloadDocument
                    action={`/apps/projects/${projectId}/search`}
                    key={v.variantId}
                    className="cu-row-spread"
                  >
                    <input type="hidden" name="environmentId" value={envId} />
                    <input type="hidden" name="productId" value={p.productId} />
                    <input type="hidden" name="variantId" value={v.variantId} />
                    <input type="hidden" name="quantity" value="1" />
                    <div>
                      <span>{v.variantTitle === "Default Title" ? p.productTitle : v.variantTitle}</span>
                      <span className="cu-muted"> — {v.price.amount} {v.price.currencyCode}</span>
                      {!v.available ? <span className="cu-product-unavailable"> · Sin stock</span> : null}
                    </div>
                    <button type="submit" className="cu-btn cu-btn-sm">Agregar</button>
                  </Form>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="cu-muted" style={{ marginTop: 16 }}>
        <Link to={`/apps/projects/${projectId}`}>Volver al proyecto</Link>
      </p>
    </CustomerLayout>
  );
}
