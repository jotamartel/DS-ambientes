import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import { errorResponse, parseJsonOrFormBody } from "~/api-helpers.server";
import { customerActor } from "~/shopify-integration/actor.server";
import {
  fetchVariantsLive,
  type LiveVariant,
  type Pegamento,
} from "~/shopify-integration/products.server";
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
import { listProjectFiles } from "~/services/file.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const actor = customerActor(request);
    const [project, files] = await Promise.all([
      getProject(actor, params.id!),
      listProjectFiles(actor, params.id!),
    ]);
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
          targetM2: item.targetM2,
          wastePct: item.wastePct,
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
        sortOrder: env.sortOrder,
        subtotal: envSubtotal,
        subtotalUsd: envHasUsd ? envSubtotalUsd : null,
        items,
        pegamentoSuggestions: pegamentoSuggestions(items),
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
        totalAmount: projectTotal,
        totalAmountUsd: hasUsd ? projectTotalUsd : null,
        currencyCode,
        updatedAt: project.updatedAt,
      },
      environments,
      files: files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        url: f.url,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        createdAt: f.createdAt,
      })),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Adhesive suggestions for one environment.
 *
 * Every m²-sold item that points at an adhesive contributes its area; areas are
 * pooled per adhesive so two floors sharing one glue produce a single row. An
 * adhesive already sitting in the environment is dropped — the customer has
 * decided how much of it they want.
 */
function pegamentoSuggestions(
  items: Array<{ variantId: string; quantity: number; live: LiveVariant | null }>,
) {
  const alreadyAdded = new Set(items.map((i) => i.variantId));
  const pooled = new Map<
    string,
    { pegamento: Pegamento; m2: number; forProducts: string[] }
  >();

  for (const item of items) {
    const live = item.live;
    if (!live || live.usageUnit !== "m2" || !live.pegamento) continue;
    if (alreadyAdded.has(live.pegamento.variantId)) continue;
    // Which floors this glue is for. Without it two suggestion rows look
    // interchangeable, as if either adhesive worked for any of the products.
    const label = live.variantTitle
      ? `${live.productTitle} — ${live.variantTitle}`
      : live.productTitle;
    const entry = pooled.get(live.pegamento.variantId);
    // Quantity is the area itself for m²-sold products.
    if (entry) {
      entry.m2 += item.quantity;
      if (!entry.forProducts.includes(label)) entry.forProducts.push(label);
    } else {
      pooled.set(live.pegamento.variantId, {
        pegamento: live.pegamento,
        m2: item.quantity,
        forProducts: [label],
      });
    }
  }

  return Array.from(pooled.values()).map(({ pegamento, m2, forProducts }) => ({
    variantId: pegamento.variantId,
    productId: pegamento.productId,
    productHandle: pegamento.productHandle,
    productTitle: pegamento.productTitle,
    variantTitle: pegamento.variantTitle,
    imageUrl: pegamento.imageUrl,
    price: pegamento.price,
    priceUsd: pegamento.priceUsd,
    available: pegamento.available,
    rendimientoM2: pegamento.rendimientoM2,
    coversM2: m2,
    forProducts,
    // Whole bags, rounded up. Epsilon guards float noise so 16/8 stays 2.
    quantity: Math.max(1, Math.ceil(m2 / pegamento.rendimientoM2 - 1e-9)),
  }));
}

const Intent = z.enum([
  "rename",
  "archive",
  "unarchive",
  "duplicate",
  "delete",
  "share-generate",
  "share-revoke",
]);

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST" && request.method !== "DELETE") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  try {
    const actor = customerActor(request);
    const projectId = params.id!;

    if (request.method === "DELETE") {
      await deleteProject(actor, projectId);
      return json({ ok: true });
    }

    const body = await parseJsonOrFormBody(request);
    const intent = Intent.safeParse(body.intent);
    if (!intent.success) return json({ error: "Intent inválido" }, { status: 400 });

    switch (intent.data) {
      case "rename": {
        const name = z.string().trim().min(1).max(120).parse(body.name);
        const updated = await updateProject(actor, projectId, { name });
        return json({ project: { id: updated.id, name: updated.name } });
      }
      case "archive":
        await archiveProject(actor, projectId);
        return json({ ok: true });
      case "unarchive":
        await unarchiveProject(actor, projectId);
        return json({ ok: true });
      case "duplicate": {
        const dup = await duplicateProject(actor, projectId);
        return json({ project: { id: dup.id, name: dup.name } }, { status: 201 });
      }
      case "delete":
        await deleteProject(actor, projectId);
        return json({ ok: true });
      case "share-generate": {
        const updated = await generateShareToken(actor, projectId);
        const publicHost = process.env.PUBLIC_SHOP_DOMAIN ?? actor.shop;
        return json({
          shareToken: updated.shareToken,
          shareUrl: `https://${publicHost}/apps/projects/share/${updated.shareToken}`,
        });
      }
      case "share-revoke":
        await revokeShareToken(actor, projectId);
        return json({ ok: true });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
