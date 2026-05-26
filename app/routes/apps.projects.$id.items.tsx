import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { z } from "zod";
import { customerActor } from "~/shopify-integration/actor.server";
import { addItem, deleteItem, updateItem } from "~/services/item.server";
import { ProjectsError } from "~/services/types";

const Intent = z.enum(["add", "update", "delete"]);

export async function action({ request, params }: ActionFunctionArgs) {
  const actor = customerActor(request);
  const projectId = params.id!;
  const formData = await request.formData();
  const intent = Intent.safeParse(formData.get("intent"));
  if (!intent.success) return json({ error: "Intent inválido" }, { status: 400 });

  try {
    switch (intent.data) {
      case "add":
        await addItem(actor, String(formData.get("environmentId") ?? ""), {
          productId: String(formData.get("productId") ?? ""),
          variantId: String(formData.get("variantId") ?? ""),
          quantity: Number(formData.get("quantity") ?? 1),
        });
        break;
      case "update": {
        const itemId = String(formData.get("itemId") ?? "");
        const qtyRaw = formData.get("quantity");
        const noteRaw = formData.get("note");
        await updateItem(actor, itemId, {
          quantity: qtyRaw != null ? Number(qtyRaw) : undefined,
          note: typeof noteRaw === "string" ? (noteRaw.length > 0 ? noteRaw : null) : undefined,
        });
        break;
      }
      case "delete":
        await deleteItem(actor, String(formData.get("itemId") ?? ""));
        break;
    }
  } catch (err) {
    if (err instanceof ProjectsError) {
      return json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
  return redirect(`/apps/projects/${projectId}`);
}
