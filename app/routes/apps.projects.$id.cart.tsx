import type { ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { z } from "zod";
import { customerActor } from "~/shopify-integration/actor.server";
import { buildCartPermalink } from "~/shopify-integration/cart.server";
import { getProject } from "~/services/project.server";
import { ProjectsError } from "~/services/types";

const Scope = z.enum(["project", "environment", "selected"]);

export async function action({ request, params }: ActionFunctionArgs) {
  const actor = customerActor(request);
  const projectId = params.id!;

  const formData = await request.formData();
  const scope = Scope.safeParse(formData.get("scope"));
  if (!scope.success) {
    return json({ error: "Scope inválido" }, { status: 400 });
  }

  try {
    const project = await getProject(actor, projectId);
    let lines: Array<{ variantId: string; quantity: number }> = [];

    if (scope.data === "project") {
      lines = project.environments.flatMap((env) =>
        env.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
      );
    } else if (scope.data === "environment") {
      const envId = String(formData.get("environmentId") ?? "");
      const env = project.environments.find((e) => e.id === envId);
      if (!env) return json({ error: "Ambiente no encontrado" }, { status: 404 });
      lines = env.items.map((item) => ({ variantId: item.variantId, quantity: item.quantity }));
    } else {
      const itemIds = new Set(formData.getAll("itemIds").map(String));
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

    const url = buildCartPermalink(actor.shop, lines, {
      Proyecto: project.name,
    });
    return redirect(url);
  } catch (err) {
    if (err instanceof ProjectsError) {
      return json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
