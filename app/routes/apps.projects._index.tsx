import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, Link, useActionData, useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { CustomerLayout, Empty, ErrorBanner } from "~/customer-ui/Layout";
import { customerActor, maybeCustomerActor } from "~/shopify-integration/actor.server";
import { createProject, listProjects } from "~/services/project.server";
import { ProjectsError } from "~/services/types";

export async function loader({ request }: LoaderFunctionArgs) {
  const actorResult = maybeCustomerActor(request);
  if ("anonymous" in actorResult) {
    return json({ anonymous: true as const, projects: [] });
  }
  const { projects } = await listProjects(actorResult, { archived: false, limit: 50 });
  return json({
    anonymous: false as const,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      itemCount: p.environments.reduce((s, e) => s + e.items.length, 0),
      environmentCount: p.environments.length,
    })),
  });
}

const NewProjectSchema = z.object({ name: z.string().trim().min(1).max(120) });

export async function action({ request }: ActionFunctionArgs) {
  const actor = customerActor(request);
  const formData = await request.formData();
  const parsed = NewProjectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return json({ error: parsed.error.issues[0]?.message ?? "Nombre inválido" }, { status: 400 });
  }
  try {
    const project = await createProject(actor, { name: parsed.data.name });
    return redirect(`/apps/projects/${project.id}`);
  } catch (err) {
    if (err instanceof ProjectsError) {
      return json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

export default function ProjectsIndex() {
  const data = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  if (data.anonymous) {
    return (
      <CustomerLayout title="Mis proyectos">
        <Empty message="Iniciá sesión en tu cuenta para ver y crear proyectos." />
        <p className="cu-muted" style={{ textAlign: "center", marginTop: 12 }}>
          <a href="/account/login" className="cu-btn cu-btn-sm">Iniciar sesión</a>
        </p>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout title="Mis proyectos">
      <ErrorBanner message={actionData?.error} />

      <section className="cu-card cu-stack">
        {/* NOTE: action is "/apps/projects" WITHOUT "?index" on purpose.
            Shopify HMAC-signs the proxied URL including all query params, but bare
            `?index` (no value) gets stripped somewhere in the browser→Shopify→Vercel
            roundtrip, so the signature we receive doesn't match and the request 403s.
            Remix routes the POST to this index action by default since the parent
            `apps.tsx` route has no action of its own. */}
        <Form method="post" reloadDocument action="/apps/projects" className="cu-stack">
          <label className="cu-label" htmlFor="new-project-name">Nuevo proyecto</label>
          <input
            id="new-project-name"
            name="name"
            type="text"
            className="cu-input"
            required
            maxLength={120}
            placeholder="Ej: Casa A — Reforma cocina"
          />
          <button type="submit" className="cu-btn cu-btn-primary">Crear</button>
        </Form>
      </section>

      {data.projects.length === 0 ? (
        <Empty message="Todavía no creaste ningún proyecto." />
      ) : (
        <div className="cu-stack">
          {data.projects.map((p) => (
            <Link key={p.id} to={`/apps/projects/${p.id}`} className="cu-card" style={{ display: "block", textDecoration: "none" }}>
              <div className="cu-row-spread">
                <div>
                  <strong>{p.name}</strong>
                  <div className="cu-muted">
                    {p.environmentCount} ambientes · {p.itemCount} productos
                  </div>
                </div>
                <span className="cu-muted">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </CustomerLayout>
  );
}
