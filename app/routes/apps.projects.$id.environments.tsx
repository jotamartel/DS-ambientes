import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { z } from "zod";
import { customerActor } from "~/shopify-integration/actor.server";
import {
  createEnvironment,
  deleteEnvironment,
  duplicateEnvironment,
  reorderEnvironments,
  updateEnvironment,
} from "~/services/environment.server";
import { ProjectsError } from "~/services/types";

const Intent = z.enum(["create", "rename", "delete", "duplicate", "reorder"]);

export async function action({ request, params }: ActionFunctionArgs) {
  const actor = customerActor(request);
  const projectId = params.id!;
  const formData = await request.formData();
  const intent = Intent.safeParse(formData.get("intent"));
  if (!intent.success) return json({ error: "Intent inválido" }, { status: 400 });

  try {
    switch (intent.data) {
      case "create":
        await createEnvironment(actor, projectId, { name: String(formData.get("name") ?? "") });
        break;
      case "rename":
        await updateEnvironment(actor, String(formData.get("environmentId") ?? ""), {
          name: String(formData.get("name") ?? ""),
        });
        break;
      case "delete":
        await deleteEnvironment(actor, String(formData.get("environmentId") ?? ""));
        break;
      case "duplicate":
        await duplicateEnvironment(actor, String(formData.get("environmentId") ?? ""));
        break;
      case "reorder":
        await reorderEnvironments(actor, projectId, formData.getAll("ids").map(String));
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
