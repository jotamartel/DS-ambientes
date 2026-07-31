import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import { errorResponse, parseJsonOrFormBody } from "~/api-helpers.server";
import { customerActor } from "~/shopify-integration/actor.server";
import { addItem, deleteItem, updateItem } from "~/services/item.server";

const Intent = z.enum(["add", "update", "delete"]);

/**
 * Read an optional numeric field from a JSON/form body.
 * Returns `undefined` when the key is absent (leave untouched on update) and
 * `null` when explicitly cleared — `Number(undefined)` would yield NaN and
 * `Number(null)` would yield 0, both of which we must not persist.
 */
function optionalNumber(raw: unknown): number | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  try {
    const actor = customerActor(request);
    const body = await parseJsonOrFormBody(request);
    const intent = Intent.safeParse(body.intent);
    if (!intent.success) return json({ error: "Intent inválido" }, { status: 400 });

    switch (intent.data) {
      case "add": {
        const handle = typeof body.productHandle === "string" && body.productHandle.length > 0
          ? body.productHandle
          : null;
        const item = await addItem(actor, String(body.environmentId ?? ""), {
          productId: String(body.productId ?? ""),
          variantId: String(body.variantId ?? ""),
          productHandle: handle,
          quantity: Number(body.quantity ?? 1),
          targetM2: optionalNumber(body.targetM2),
          wastePct: optionalNumber(body.wastePct),
          note: typeof body.note === "string" && body.note.length > 0 ? body.note : null,
        });
        return json({
          item: {
            id: item.id,
            environmentId: item.environmentId,
            variantId: item.variantId,
            productId: item.productId,
            productHandle: item.productHandle,
            quantity: item.quantity,
            targetM2: item.targetM2,
            wastePct: item.wastePct,
            note: item.note,
          },
        }, { status: 201 });
      }
      case "update": {
        const itemId = String(body.itemId ?? "");
        const qty = body.quantity != null ? Number(body.quantity) : undefined;
        const note = typeof body.note === "string"
          ? (body.note.length > 0 ? body.note : null)
          : undefined;
        const item = await updateItem(actor, itemId, {
          quantity: qty,
          targetM2: optionalNumber(body.targetM2),
          wastePct: optionalNumber(body.wastePct),
          note,
        });
        return json({
          item: {
            id: item.id,
            quantity: item.quantity,
            targetM2: item.targetM2,
            wastePct: item.wastePct,
            note: item.note,
          },
        });
      }
      case "delete":
        await deleteItem(actor, String(body.itemId ?? ""));
        return json({ ok: true });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
