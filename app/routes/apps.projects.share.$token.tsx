import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData, useParams } from "@remix-run/react";
import { CustomerLayout, Empty, ErrorBanner } from "~/customer-ui/Layout";
import { authenticateAppProxy } from "~/shopify-integration/app-proxy.server";
import { buildCartPermalink } from "~/shopify-integration/cart.server";
import { fetchVariantsLive, type LiveVariant } from "~/shopify-integration/products.server";
import { getProjectByShareToken } from "~/services/project.server";
import { ProjectsError } from "~/services/types";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { shop } = authenticateAppProxy(request);
  const project = await getProjectByShareToken(params.token!);
  if (!project) {
    throw new Response("Not Found", { status: 404 });
  }

  const variantLookups = project.environments.flatMap((e) =>
    e.items.map((i) => ({ variantId: i.variantId, productHandle: i.productHandle })),
  );
  const live = variantLookups.length > 0
    ? await fetchVariantsLive(shop, variantLookups)
    : new Map<string, LiveVariant | null>();

  let projectTotal = 0;
  let projectTotalUsd = 0;
  let hasUsd = false;
  let currencyCode = process.env.SHOP_CURRENCY ?? "ARS";
  const environments = project.environments.map((env) => {
    let envSubtotal = 0;
    let envSubtotalUsd = 0;
    let envHasUsd = false;
    const items = env.items.map((item) => {
      const v = live.get(item.variantId) ?? null;
      if (v) {
        envSubtotal += parseFloat(v.price.amount) * item.quantity;
        currencyCode = v.price.currencyCode;
        if (v.priceUsd) {
          envSubtotalUsd += parseFloat(v.priceUsd.amount) * item.quantity;
          envHasUsd = true;
        }
      }
      return {
        id: item.id,
        variantId: item.variantId,
        quantity: item.quantity,
        note: item.note,
        live: v,
      };
    });
    projectTotal += envSubtotal;
    if (envHasUsd) {
      projectTotalUsd += envSubtotalUsd;
      hasUsd = true;
    }
    return {
      id: env.id,
      name: env.name,
      subtotal: envSubtotal,
      subtotalUsd: envHasUsd ? envSubtotalUsd : null,
      items,
    };
  });

  return json({
    name: project.name,
    clientName: project.clientName,
    totalAmount: projectTotal,
    totalAmountUsd: hasUsd ? projectTotalUsd : null,
    currencyCode,
    environments,
  });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { shop } = authenticateAppProxy(request);
  const project = await getProjectByShareToken(params.token!);
  if (!project) throw new Response("Not Found", { status: 404 });

  const formData = await request.formData();
  const environmentId = formData.get("environmentId");

  let lines: Array<{ variantId: string; quantity: number }>;
  let attributes: Record<string, string> = { Proyecto: project.name };

  if (typeof environmentId === "string" && environmentId.length > 0) {
    const env = project.environments.find((e) => e.id === environmentId);
    if (!env) return json({ error: "Ambiente no encontrado" }, { status: 404 });
    lines = env.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity }));
    attributes = { ...attributes, Ambiente: env.name };
  } else {
    lines = project.environments.flatMap((env) =>
      env.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
    );
  }

  if (lines.length === 0) {
    return json({ error: "No hay productos para agregar." }, { status: 400 });
  }

  try {
    const url = buildCartPermalink(shop, lines, attributes);
    return redirect(url);
  } catch (err) {
    if (err instanceof ProjectsError) {
      return json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

function formatPrice(amount: number, currency: string, fractionDigits = 0): string {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(fractionDigits)}`;
  }
}

export default function PublicShare() {
  const { name, clientName, totalAmount, totalAmountUsd, currencyCode, environments } = useLoaderData<typeof loader>();
  const { token } = useParams();
  const totalItems = environments.reduce((s, e) => s + e.items.length, 0);
  const totalDisplay = totalAmount > 0 ? formatPrice(totalAmount, currencyCode) : "—";
  const totalUsdDisplay = totalAmountUsd != null && totalAmountUsd > 0
    ? formatPrice(totalAmountUsd, "USD", 2)
    : null;

  return (
    <CustomerLayout
      eyebrow={clientName ? `Propuesta para ${clientName}` : "Propuesta DS Forma"}
      title={name}
    >
      {environments.length === 0 || totalItems === 0 ? (
        <Empty message="Este proyecto está vacío." />
      ) : (
        <>
          <div className="cu-stats">
            <div className="cu-stat">
              <p className="cu-stat-label">Ambientes</p>
              <p className="cu-stat-value">{environments.length}</p>
            </div>
            <div className="cu-stat">
              <p className="cu-stat-label">Productos</p>
              <p className="cu-stat-value">{totalItems}</p>
            </div>
            <div className="cu-stat cu-stat-highlight">
              <p className="cu-stat-label">Inversión estimada</p>
              <p className="cu-stat-value">{totalDisplay}</p>
              {totalUsdDisplay ? (
                <p className="cu-stat-secondary">{totalUsdDisplay}</p>
              ) : null}
            </div>
          </div>

          <div className="cu-stack">
            {environments.map((env) => (
              <article key={env.id} className="cu-environment">
                <header className="cu-environment-header">
                  <div className="cu-row" style={{ gap: 12 }}>
                    <h2 className="cu-environment-name">{env.name}</h2>
                    {env.subtotal > 0 ? (
                      <span className="cu-env-subtotal">
                        {formatPrice(env.subtotal, currencyCode)}
                        {env.subtotalUsd != null && env.subtotalUsd > 0 ? (
                          <span className="cu-env-subtotal-usd"> · {formatPrice(env.subtotalUsd, "USD", 2)}</span>
                        ) : null}
                      </span>
                    ) : null}
                  </div>
                  {env.items.length > 0 ? (
                    <Form method="post" reloadDocument action={`/apps/projects/share/${token}`}>
                      <input type="hidden" name="environmentId" value={env.id} />
                      <button type="submit" className="cu-btn cu-btn-sm">
                        Agregar este ambiente al carrito
                      </button>
                    </Form>
                  ) : null}
                </header>
                <div className="cu-environment-body">
                  {env.items.length === 0 ? (
                    <p className="cu-muted" style={{ padding: "16px 0" }}>Sin productos.</p>
                  ) : (
                    env.items.map((item) => (
                      <div key={item.id} className="cu-item">
                        {item.live?.imageUrl ? (
                          <img
                            src={item.live.imageUrl}
                            alt={item.live.imageAlt ?? ""}
                            className="cu-product-img"
                            loading="lazy"
                          />
                        ) : (
                          <div className="cu-product-img" />
                        )}
                        <div className="cu-product-info">
                          {item.live ? (
                            <>
                              <p className="cu-product-title">{item.live.productTitle}</p>
                              {item.live.variantTitle ? (
                                <p className="cu-product-variant">{item.live.variantTitle}</p>
                              ) : null}
                              <p className="cu-product-price">
                                {formatPrice(parseFloat(item.live.price.amount), item.live.price.currencyCode, 0)}
                              </p>
                              {item.live.priceUsd ? (
                                <p className="cu-product-price-usd">
                                  {formatPrice(parseFloat(item.live.priceUsd.amount), item.live.priceUsd.currencyCode, 2)}
                                </p>
                              ) : null}
                              <p className="cu-product-qty">Cantidad: {item.quantity}</p>
                              {!item.live.available ? (
                                <p className="cu-product-unavailable">Sin stock</p>
                              ) : null}
                            </>
                          ) : (
                            <p className="cu-product-unavailable">Producto no disponible</p>
                          )}
                          {item.note ? <p className="cu-product-note">{item.note}</p> : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </article>
            ))}
          </div>
        </>
      )}

      {totalItems > 0 ? (
        <div className="cu-summary">
          <div className="cu-summary-left">
            <span className="cu-summary-label">Total · {totalItems} productos</span>
            <span className="cu-summary-total">{totalDisplay}</span>
            {totalUsdDisplay ? (
              <span className="cu-summary-total-usd">{totalUsdDisplay}</span>
            ) : null}
          </div>
          <Form method="post" reloadDocument action={`/apps/projects/share/${token}`}>
            <button type="submit" className="cu-btn cu-btn-primary">
              Agregar todo al carrito
            </button>
          </Form>
        </div>
      ) : null}
    </CustomerLayout>
  );
}

export function ErrorBoundary() {
  return (
    <CustomerLayout title="Enlace no encontrado">
      <ErrorBanner message="Este enlace no existe o fue revocado." />
    </CustomerLayout>
  );
}
