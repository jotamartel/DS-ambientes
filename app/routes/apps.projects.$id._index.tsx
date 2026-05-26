import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { CustomerLayout, Empty, ErrorBanner } from "~/customer-ui/Layout";
import { customerActor } from "~/shopify-integration/actor.server";
import { fetchVariantsLive, type LiveVariant } from "~/shopify-integration/products.server";
import {
  archiveProject,
  deleteProject,
  duplicateProject,
  generateShareToken,
  getProject,
  revokeShareToken,
  unarchiveProject,
  updateProject,
} from "~/services/project.server";
import { ProjectsError } from "~/services/types";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const actor = customerActor(request);
  const projectId = params.id!;
  const project = await getProject(actor, projectId);

  const variantLookups = project.environments.flatMap((e) =>
    e.items.map((i) => ({ variantId: i.variantId, productHandle: i.productHandle })),
  );
  const live = variantLookups.length > 0
    ? await fetchVariantsLive(actor.shop, variantLookups).catch(() => new Map<string, LiveVariant | null>())
    : new Map<string, LiveVariant | null>();

  const publicHost = process.env.PUBLIC_SHOP_DOMAIN ?? actor.shop;
  const shareUrl = project.shareToken
    ? `https://${publicHost}/apps/projects/share/${project.shareToken}`
    : null;

  let totalAmount = 0;
  let totalAmountUsd = 0;
  let hasUsd = false;
  let currencyCode = process.env.SHOP_CURRENCY ?? "ARS";

  const environments = project.environments.map((env) => {
    let subtotal = 0;
    let subtotalUsd = 0;
    let envHasUsd = false;
    const items = env.items.map((item) => {
      const v = live.get(item.variantId) ?? null;
      if (v) {
        subtotal += parseFloat(v.price.amount) * item.quantity;
        currencyCode = v.price.currencyCode;
        if (v.priceUsd) {
          subtotalUsd += parseFloat(v.priceUsd.amount) * item.quantity;
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
    totalAmount += subtotal;
    if (envHasUsd) {
      totalAmountUsd += subtotalUsd;
      hasUsd = true;
    }
    return {
      id: env.id,
      name: env.name,
      sortOrder: env.sortOrder,
      subtotal,
      subtotalUsd: envHasUsd ? subtotalUsd : null,
      items,
    };
  });

  return json({
    project: {
      id: project.id,
      name: project.name,
      archived: project.archived,
      clientName: project.clientName,
      shareToken: project.shareToken,
      shareUrl,
      totalAmount,
      totalAmountUsd: hasUsd ? totalAmountUsd : null,
      currencyCode,
      updatedAt: project.updatedAt,
    },
    environments,
  });
}

const Intent = z.enum([
  "rename",
  "archive",
  "unarchive",
  "delete",
  "duplicate",
  "share-generate",
  "share-revoke",
]);

export async function action({ request, params }: ActionFunctionArgs) {
  const actor = customerActor(request);
  const projectId = params.id!;
  const formData = await request.formData();
  const intent = Intent.safeParse(formData.get("intent"));
  if (!intent.success) return json({ error: "Acción inválida" }, { status: 400 });

  try {
    switch (intent.data) {
      case "rename": {
        const name = z.string().trim().min(1).max(120).parse(formData.get("name"));
        await updateProject(actor, projectId, { name });
        return redirect(`/apps/projects/${projectId}`);
      }
      case "archive":
        await archiveProject(actor, projectId);
        return redirect(`/apps/projects`);
      case "unarchive":
        await unarchiveProject(actor, projectId);
        return redirect(`/apps/projects/${projectId}`);
      case "delete":
        await deleteProject(actor, projectId);
        return redirect(`/apps/projects`);
      case "duplicate": {
        const dup = await duplicateProject(actor, projectId);
        return redirect(`/apps/projects/${dup.id}`);
      }
      case "share-generate":
        await generateShareToken(actor, projectId);
        return redirect(`/apps/projects/${projectId}`);
      case "share-revoke":
        await revokeShareToken(actor, projectId);
        return redirect(`/apps/projects/${projectId}`);
    }
  } catch (err) {
    if (err instanceof ProjectsError) {
      return json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  return json({ error: "Acción no implementada" }, { status: 400 });
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

function formatRelative(iso: string | Date | undefined): string {
  if (!iso) return "";
  try {
    const then = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - then);
    const min = Math.floor(diff / 60_000);
    if (min < 1) return "ahora";
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    if (d < 7) return `hace ${d} día${d === 1 ? "" : "s"}`;
    const w = Math.floor(d / 7);
    if (w < 5) return `hace ${w} semana${w === 1 ? "" : "s"}`;
    return `hace ${Math.floor(d / 30)} meses`;
  } catch {
    return "";
  }
}

export default function ProjectDetail() {
  const { project, environments } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  const totalItems = environments.reduce((s, e) => s + e.items.length, 0);
  const totalDisplay = project.totalAmount > 0
    ? formatPrice(project.totalAmount, project.currencyCode)
    : "—";
  const totalUsdDisplay = project.totalAmountUsd != null && project.totalAmountUsd > 0
    ? formatPrice(project.totalAmountUsd, "USD", 2)
    : null;

  return (
    <CustomerLayout
      title={project.name}
      back={{ to: "/apps/projects", label: "Mis proyectos" }}
    >
      <ErrorBanner message={actionData?.error} />

      {/* Stats row */}
      <div className="cu-stats cu-stats-4">
        <div className="cu-stat">
          <p className="cu-stat-label">Ambientes</p>
          <p className="cu-stat-value">{environments.length}</p>
        </div>
        <div className="cu-stat">
          <p className="cu-stat-label">Productos</p>
          <p className="cu-stat-value">{totalItems}</p>
        </div>
        <div className="cu-stat cu-stat-highlight">
          <p className="cu-stat-label">Total estimado</p>
          <p className="cu-stat-value">{totalDisplay}</p>
          {totalUsdDisplay ? <p className="cu-stat-secondary">{totalUsdDisplay}</p> : null}
        </div>
        <div className="cu-stat">
          <p className="cu-stat-label">Actualizado</p>
          <p className="cu-stat-value" style={{ fontSize: 14, fontWeight: 500 }}>
            {formatRelative(project.updatedAt)}
          </p>
        </div>
      </div>

      {/* Project actions card */}
      <div className="cu-card cu-stack">
        <Form method="post" reloadDocument action={`/apps/projects/${project.id}`}>
          <input type="hidden" name="intent" value="rename" />
          <label className="cu-label">Nombre del proyecto</label>
          <div className="cu-row" style={{ gap: 8 }}>
            <input
              name="name"
              defaultValue={project.name}
              className="cu-input"
              style={{ flex: 1, minWidth: 200 }}
              required
              maxLength={120}
            />
            <button type="submit" className="cu-btn cu-btn-sm">Guardar</button>
          </div>
        </Form>

        <div className="cu-row" style={{ flexWrap: "wrap", gap: 8 }}>
          <Form method="post" reloadDocument action={`/apps/projects/${project.id}`}>
            <input type="hidden" name="intent" value="duplicate" />
            <button type="submit" className="cu-btn cu-btn-sm">Duplicar</button>
          </Form>
          {project.archived ? (
            <Form method="post" reloadDocument action={`/apps/projects/${project.id}`}>
              <input type="hidden" name="intent" value="unarchive" />
              <button type="submit" className="cu-btn cu-btn-sm">Desarchivar</button>
            </Form>
          ) : (
            <Form method="post" reloadDocument action={`/apps/projects/${project.id}`}>
              <input type="hidden" name="intent" value="archive" />
              <button type="submit" className="cu-btn cu-btn-sm">Archivar</button>
            </Form>
          )}
          <Form
            method="post"
            reloadDocument
            action={`/apps/projects/${project.id}`}
            onSubmit={(e) => {
              if (!confirm("¿Eliminar el proyecto? No se puede deshacer.")) e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <button type="submit" className="cu-btn cu-btn-sm cu-btn-danger">Eliminar</button>
          </Form>
        </div>
      </div>

      {/* Share */}
      <div className="cu-card cu-stack">
        <strong className="cu-h3">Compartir con cliente</strong>
        {project.shareUrl ? (
          <>
            <input
              className="cu-input"
              readOnly
              value={project.shareUrl}
              onClick={(e) => e.currentTarget.select()}
            />
            <Form method="post" reloadDocument action={`/apps/projects/${project.id}`}>
              <input type="hidden" name="intent" value="share-revoke" />
              <button type="submit" className="cu-btn cu-btn-sm">Revocar enlace</button>
            </Form>
          </>
        ) : (
          <>
            <p className="cu-muted">Generá un enlace público que tu cliente pueda abrir para ver la propuesta.</p>
            <Form method="post" reloadDocument action={`/apps/projects/${project.id}`}>
              <input type="hidden" name="intent" value="share-generate" />
              <button type="submit" className="cu-btn cu-btn-sm">Generar enlace</button>
            </Form>
          </>
        )}
      </div>

      {/* New environment */}
      <Form
        method="post"
        reloadDocument
        action={`/apps/projects/${project.id}/environments`}
        className="cu-card"
      >
        <input type="hidden" name="intent" value="create" />
        <div className="cu-row" style={{ gap: 8 }}>
          <input
            name="name"
            placeholder="Nuevo ambiente (ej: Cocina)"
            className="cu-input"
            required
            maxLength={80}
            style={{ flex: 1 }}
          />
          <button type="submit" className="cu-btn">+ Agregar ambiente</button>
        </div>
      </Form>

      {/* Environment list */}
      {environments.length === 0 ? (
        <Empty message="Todavía no agregaste ambientes a este proyecto." />
      ) : (
        environments.map((env, idx) => (
          <EnvironmentCard
            key={env.id}
            projectId={project.id}
            currencyCode={project.currencyCode}
            env={env}
            isFirst={idx === 0}
            isLast={idx === environments.length - 1}
            orderedIds={environments.map((e) => e.id)}
          />
        ))
      )}

      {/* Sticky CTA */}
      {totalItems > 0 ? (
        <div className="cu-summary">
          <div className="cu-summary-left">
            <span className="cu-summary-label">Total · {totalItems} productos</span>
            <span className="cu-summary-total">{totalDisplay}</span>
            {totalUsdDisplay ? <span className="cu-summary-total-usd">{totalUsdDisplay}</span> : null}
          </div>
          <Form method="post" reloadDocument action={`/apps/projects/${project.id}/cart`}>
            <input type="hidden" name="scope" value="project" />
            <button type="submit" className="cu-btn cu-btn-primary">
              Agregar todo al carrito
            </button>
          </Form>
        </div>
      ) : null}
    </CustomerLayout>
  );
}

function EnvironmentCard({
  projectId,
  currencyCode,
  env,
  isFirst,
  isLast,
  orderedIds,
}: {
  projectId: string;
  currencyCode: string;
  env: {
    id: string;
    name: string;
    subtotal: number;
    subtotalUsd: number | null;
    items: Array<{
      id: string;
      variantId: string;
      quantity: number;
      note: string | null;
      live: LiveVariant | null;
    }>;
  };
  isFirst: boolean;
  isLast: boolean;
  orderedIds: string[];
}) {
  const moveUp = orderedIds.slice();
  const moveDown = orderedIds.slice();
  const i = orderedIds.indexOf(env.id);
  if (i > 0) [moveUp[i - 1], moveUp[i]] = [moveUp[i], moveUp[i - 1]];
  if (i < orderedIds.length - 1) [moveDown[i + 1], moveDown[i]] = [moveDown[i], moveDown[i + 1]];

  const subtotalDisplay = env.subtotal > 0 ? formatPrice(env.subtotal, currencyCode) : null;
  const subtotalUsdDisplay = env.subtotalUsd != null && env.subtotalUsd > 0
    ? formatPrice(env.subtotalUsd, "USD", 2)
    : null;

  return (
    <article className="cu-environment">
      <header className="cu-environment-header">
        <div className="cu-row" style={{ gap: 12 }}>
          <h2 className="cu-environment-name">{env.name}</h2>
          {subtotalDisplay ? (
            <span className="cu-env-subtotal">
              {subtotalDisplay}
              {subtotalUsdDisplay ? <span className="cu-env-subtotal-usd"> · {subtotalUsdDisplay}</span> : null}
            </span>
          ) : null}
        </div>
        <div className="cu-row" style={{ gap: 4, flexWrap: "wrap" }}>
          {!isFirst && (
            <Form method="post" reloadDocument action={`/apps/projects/${projectId}/environments`}>
              <input type="hidden" name="intent" value="reorder" />
              {moveUp.map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
              <button type="submit" className="cu-btn cu-btn-sm" aria-label="Subir">↑</button>
            </Form>
          )}
          {!isLast && (
            <Form method="post" reloadDocument action={`/apps/projects/${projectId}/environments`}>
              <input type="hidden" name="intent" value="reorder" />
              {moveDown.map((id) => <input key={id} type="hidden" name="ids" value={id} />)}
              <button type="submit" className="cu-btn cu-btn-sm" aria-label="Bajar">↓</button>
            </Form>
          )}
          <Form method="post" reloadDocument action={`/apps/projects/${projectId}/environments`}>
            <input type="hidden" name="intent" value="duplicate" />
            <input type="hidden" name="environmentId" value={env.id} />
            <button type="submit" className="cu-btn cu-btn-sm">Duplicar</button>
          </Form>
          <Form
            method="post"
            reloadDocument
            action={`/apps/projects/${projectId}/environments`}
            onSubmit={(e) => {
              if (!confirm("¿Eliminar el ambiente y todos sus productos?")) e.preventDefault();
            }}
          >
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="environmentId" value={env.id} />
            <button type="submit" className="cu-btn cu-btn-sm cu-btn-danger">Eliminar</button>
          </Form>
        </div>
      </header>
      <div className="cu-environment-body">
        <Form method="post" reloadDocument action={`/apps/projects/${projectId}/environments`} style={{ marginBottom: 12 }}>
          <input type="hidden" name="intent" value="rename" />
          <input type="hidden" name="environmentId" value={env.id} />
          <div className="cu-row" style={{ gap: 8 }}>
            <input name="name" defaultValue={env.name} className="cu-input" required maxLength={80} style={{ flex: 1 }} />
            <button type="submit" className="cu-btn cu-btn-sm">Renombrar</button>
          </div>
        </Form>

        <div className="cu-row" style={{ gap: 8, marginBottom: 12 }}>
          <Link to={`/apps/projects/${projectId}/search?env=${env.id}`} className="cu-btn cu-btn-sm">
            + Agregar producto
          </Link>
          {env.items.length > 0 ? (
            <Form method="post" reloadDocument action={`/apps/projects/${projectId}/cart`}>
              <input type="hidden" name="scope" value="environment" />
              <input type="hidden" name="environmentId" value={env.id} />
              <button type="submit" className="cu-btn cu-btn-sm">
                Agregar este ambiente al carrito
              </button>
            </Form>
          ) : null}
        </div>

        {env.items.length === 0 ? (
          <p className="cu-muted" style={{ padding: "8px 0" }}>Sin productos en este ambiente.</p>
        ) : (
          env.items.map((item) => (
            <ItemRow key={item.id} projectId={projectId} item={item} />
          ))
        )}
      </div>
    </article>
  );
}

function ItemRow({
  projectId,
  item,
}: {
  projectId: string;
  item: {
    id: string;
    variantId: string;
    quantity: number;
    note: string | null;
    live: LiveVariant | null;
  };
}) {
  const live = item.live;
  const priceText = live ? formatPrice(parseFloat(live.price.amount), live.price.currencyCode) : null;
  const usdText = live?.priceUsd
    ? formatPrice(parseFloat(live.priceUsd.amount), live.priceUsd.currencyCode, 2)
    : null;

  return (
    <div className="cu-item">
      {live?.imageUrl ? (
        <img src={live.imageUrl} alt={live.imageAlt ?? ""} className="cu-product-img" loading="lazy" />
      ) : (
        <div className="cu-product-img" />
      )}
      <div className="cu-product-info">
        {live ? (
          <>
            <p className="cu-product-title">{live.productTitle}</p>
            {live.variantTitle ? <p className="cu-product-variant">{live.variantTitle}</p> : null}
            <p className="cu-product-price">{priceText}</p>
            {usdText ? <p className="cu-product-price-usd">{usdText}</p> : null}
            {!live.available ? <p className="cu-product-unavailable">Sin stock</p> : null}
          </>
        ) : (
          <p className="cu-product-unavailable">Producto no disponible o eliminado</p>
        )}

        <Form
          method="post"
          reloadDocument
          action={`/apps/projects/${projectId}/items`}
          className="cu-item-edit"
          style={{ marginTop: 10 }}
        >
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="itemId" value={item.id} />
          <div className="cu-row" style={{ gap: 8, alignItems: "center" }}>
            <label className="cu-label-inline" htmlFor={`qty-${item.id}`}>Cant.</label>
            <input
              id={`qty-${item.id}`}
              type="number"
              name="quantity"
              defaultValue={item.quantity}
              min={1}
              max={9999}
              className="cu-input cu-qty"
            />
            <textarea
              name="note"
              defaultValue={item.note ?? ""}
              placeholder="Nota opcional"
              className="cu-textarea cu-note-input"
              maxLength={500}
              rows={1}
            />
            <button type="submit" className="cu-btn cu-btn-sm">Guardar</button>
          </div>
        </Form>
      </div>
      <div className="cu-item-actions">
        <Form method="post" reloadDocument action={`/apps/projects/${projectId}/items`}>
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="itemId" value={item.id} />
          <button type="submit" className="cu-btn cu-btn-sm cu-btn-danger">Quitar</button>
        </Form>
      </div>
    </div>
  );
}
