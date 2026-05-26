import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import { errorResponse, parseJsonOrFormBody } from "~/api-helpers.server";
import { customerActor } from "~/shopify-integration/actor.server";
import {
  createEnvironment,
  deleteEnvironment,
  duplicateEnvironment,
  reorderEnvironments,
  updateEnvironment,
} from "~/services/environment.server";

const Intent = z.enum(["create", "rename", "delete", "duplicate", "reorder"]);

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  try {
    const actor = customerActor(request);
    const projectId = params.id!;
    const body = await parseJsonOrFormBody(request);
    const intent = Intent.safeParse(body.intent);
    if (!intent.success) return json({ error: "Intent inválido" }, { status: 400 });

    switch (intent.data) {
      case "create": {
        const env = await createEnvironment(actor, projectId, {
          name: String(body.name ?? ""),
        });
        return json({ environment: { id: env.id, name: env.name, sortOrder: env.sortOrder, items: [] } }, { status: 201 });
      }
      case "rename": {
        const env = await updateEnvironment(actor, String(body.environmentId ?? ""), {
          name: String(body.name ?? ""),
        });
        return json({ environment: { id: env.id, name: env.name } });
      }
      case "delete":
        await deleteEnvironment(actor, String(body.environmentId ?? ""));
        return json({ ok: true });
      case "duplicate": {
        const env = await duplicateEnvironment(actor, String(body.environmentId ?? ""));
        return json({
          environment: {
            id: env.id,
            name: env.name,
            sortOrder: env.sortOrder,
            items: env.items.map((i) => ({
              id: i.id,
              variantId: i.variantId,
              productId: i.productId,
              productHandle: i.productHandle,
              quantity: i.quantity,
              note: i.note,
            })),
          },
        }, { status: 201 });
      }
      case "reorder": {
        const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
        const result = await reorderEnvironments(actor, projectId, ids);
        return json({ environments: result.map((e) => ({ id: e.id, sortOrder: e.sortOrder })) });
      }
    }
  } catch (err) {
    return errorResponse(err);
  }
}
