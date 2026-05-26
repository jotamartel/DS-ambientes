import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import { errorResponse, parseJsonOrFormBody } from "~/api-helpers.server";
import { customerActor } from "~/shopify-integration/actor.server";
import { buildCartPermalink } from "~/shopify-integration/cart.server";
import { getProject } from "~/services/project.server";

const Scope = z.enum(["project", "environment", "selected"]);

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  try {
    const actor = customerActor(request);
    const body = await parseJsonOrFormBody(request);
    const scope = Scope.safeParse(body.scope);
    if (!scope.success) return json({ error: "Scope inválido" }, { status: 400 });

    const project = await getProject(actor, params.id!);
    let lines: Array<{ variantId: string; quantity: number }> = [];

    if (scope.data === "project") {
      lines = project.environments.flatMap((env) =>
        env.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
      );
    } else if (scope.data === "environment") {
      const env = project.environments.find((e) => e.id === String(body.environmentId ?? ""));
      if (!env) return json({ error: "Ambiente no encontrado" }, { status: 404 });
      lines = env.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity }));
    } else {
      const itemIds = new Set(Array.isArray(body.itemIds) ? body.itemIds.map(String) : []);
      project.environments.forEach((env) => {
        env.items.forEach((item) => {
          if (itemIds.has(item.id)) {
            lines.push({ variantId: item.variantId, quantity: item.quantity });
          }
        });
      });
    }

    if (lines.length === 0) {
      return json({ error: "No hay productos para agregar" }, { status: 400 });
    }

    const checkoutUrl = buildCartPermalink(actor.shop, lines, { Proyecto: project.name });
    return json({ checkoutUrl });
  } catch (err) {
    return errorResponse(err);
  }
}
