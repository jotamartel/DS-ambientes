import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  getProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getProjectStats,
} from "../services/project.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  try {
    if (id) {
      const project = await getProject(id, shop);
      if (!project) {
        return json({ error: "Proyecto no encontrado" }, { status: 404 });
      }
      return json({ project });
    }

    const status = url.searchParams.get("status") || undefined;
    const search = url.searchParams.get("search") || undefined;
    const page = parseInt(url.searchParams.get("page") || "1", 10);

    const [projectsData, stats] = await Promise.all([
      getProjects(shop, { status, search, page }),
      getProjectStats(shop),
    ]);

    return json({ ...projectsData, stats });
  } catch (error) {
    console.error("Error in projects API:", error);
    return json({ error: "Error al obtener proyectos" }, { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const action = formData.get("_action") as string;

  try {
    switch (action) {
      case "create": {
        const name = formData.get("name") as string;
        const clientName = formData.get("clientName") as string | null;
        const clientEmail = formData.get("clientEmail") as string | null;

        if (!name) {
          return json({ error: "El nombre es requerido" }, { status: 400 });
        }

        const project = await createProject(shop, {
          name,
          clientName: clientName || undefined,
          clientEmail: clientEmail || undefined,
        });

        return json({ project });
      }

      case "update": {
        const id = formData.get("id") as string;
        const name = formData.get("name") as string;
        const clientName = formData.get("clientName") as string;
        const clientEmail = formData.get("clientEmail") as string;
        const status = formData.get("status") as string;

        const project = await updateProject(id, shop, {
          name,
          clientName: clientName || null,
          clientEmail: clientEmail || null,
          status,
        });

        return json({ project });
      }

      case "delete": {
        const id = formData.get("id") as string;
        await deleteProject(id, shop);
        return json({ success: true });
      }

      default:
        return json({ error: "Acción no válida" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in projects API action:", error);
    return json({ error: "Error al procesar la solicitud" }, { status: 500 });
  }
};
