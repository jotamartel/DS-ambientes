import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { errorResponse } from "~/api-helpers.server";
import { customerActor } from "~/shopify-integration/actor.server";
import { deleteProjectFile } from "~/services/file.server";

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "DELETE") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  try {
    const actor = customerActor(request);
    await deleteProjectFile(actor, params.id!, params.fileId!);
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
