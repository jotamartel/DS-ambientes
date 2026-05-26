import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import { customerActor } from "~/shopify-integration/actor.server";
import { createProject, listProjects } from "~/services/project.server";
import { ProjectsError } from "~/services/types";
import { errorResponse, parseJsonOrFormBody } from "~/api-helpers.server";
import { fetchVariantsLive, type LiveVariant } from "~/shopify-integration/products.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const actor = customerActor(request);
    const { projects } = await listProjects(actor, { archived: false, limit: 100 });

    // Batch fetch live data for ALL items across ALL projects, so we can
    // compute the total per project. fetchVariantsLive uses cached handles,
    // so this is one parallel fetch per unique product handle.
    const variantLookups = projects.flatMap((p) =>
      p.environments.flatMap((e) =>
        e.items.map((i) => ({ variantId: i.variantId, productHandle: i.productHandle })),
      ),
    );
    const live = variantLookups.length > 0
      ? await fetchVariantsLive(actor.shop, variantLookups).catch(() => new Map<string, LiveVariant | null>())
      : new Map<string, LiveVariant | null>();

    return json({
      projects: projects.map((p) => {
        let total = 0;
        let totalUsd = 0;
        let hasUsd = false;
        let currencyCode = process.env.SHOP_CURRENCY ?? "ARS";
        for (const env of p.environments) {
          for (const item of env.items) {
            const v = live.get(item.variantId);
            if (v) {
              total += parseFloat(v.price.amount) * item.quantity;
              currencyCode = v.price.currencyCode;
              if (v.priceUsd) {
                totalUsd += parseFloat(v.priceUsd.amount) * item.quantity;
                hasUsd = true;
              }
            }
          }
        }
        return {
          id: p.id,
          name: p.name,
          archived: p.archived,
          environmentCount: p.environments.length,
          itemCount: p.environments.reduce((s, e) => s + e.items.length, 0),
          totalAmount: total,
          totalAmountUsd: hasUsd ? totalUsd : null,
          currencyCode,
          updatedAt: p.updatedAt,
        };
      }),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

const CreateSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  try {
    const actor = customerActor(request);
    const body = await parseJsonOrFormBody(request);
    const parsed = CreateSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: parsed.error.issues[0]?.message ?? "Nombre inválido" }, { status: 400 });
    }
    const project = await createProject(actor, { name: parsed.data.name });
    return json({ project: { id: project.id, name: project.name } }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
