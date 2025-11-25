import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  createList,
  updateList,
  deleteList,
  duplicateList,
  reorderLists,
  addItemToList,
  updateListItem,
  deleteListItem,
} from "../services/project.server";
import { getProductVariant } from "../services/shopify.api.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const action = formData.get("_action") as string;

  try {
    switch (action) {
      case "createList": {
        const projectId = formData.get("projectId") as string;
        const name = formData.get("name") as string;

        if (!projectId || !name) {
          return json({ error: "Datos incompletos" }, { status: 400 });
        }

        const list = await createList(projectId, shop, { name });
        return json({ list });
      }

      case "updateList": {
        const listId = formData.get("listId") as string;
        const name = formData.get("name") as string;

        const list = await updateList(listId, shop, { name });
        return json({ list });
      }

      case "deleteList": {
        const listId = formData.get("listId") as string;
        await deleteList(listId, shop);
        return json({ success: true });
      }

      case "duplicateList": {
        const listId = formData.get("listId") as string;
        const list = await duplicateList(listId, shop);
        return json({ list });
      }

      case "reorderLists": {
        const projectId = formData.get("projectId") as string;
        const orderJson = formData.get("order") as string;
        const order = JSON.parse(orderJson);

        await reorderLists(projectId, shop, order);
        return json({ success: true });
      }

      case "addItem": {
        const listId = formData.get("listId") as string;
        const variantId = formData.get("variantId") as string;
        const quantity = parseInt(formData.get("quantity") as string, 10) || 1;
        const comment = formData.get("comment") as string | null;

        // Get variant info from Shopify
        const variant = await getProductVariant(admin, variantId);

        if (!variant) {
          return json({ error: "Variante no encontrada" }, { status: 404 });
        }

        const item = await addItemToList(listId, shop, {
          shopifyProductId: variant.product.id,
          shopifyVariantId: variant.id,
          productTitle: variant.product.title,
          variantTitle: variant.title !== "Default Title" ? variant.title : undefined,
          productImage: variant.image?.url || variant.product.featuredImage?.url,
          quantity,
          unitPrice: parseFloat(variant.price),
          comment: comment || undefined,
        });

        return json({ item });
      }

      case "updateItem": {
        const itemId = formData.get("itemId") as string;
        const quantity = parseInt(formData.get("quantity") as string, 10);
        const comment = formData.get("comment") as string;

        const item = await updateListItem(itemId, shop, {
          quantity: quantity || undefined,
          comment: comment || null,
        });

        return json({ item });
      }

      case "deleteItem": {
        const itemId = formData.get("itemId") as string;
        await deleteListItem(itemId, shop);
        return json({ success: true });
      }

      default:
        return json({ error: "Acción no válida" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in lists API:", error);
    return json(
      { error: error instanceof Error ? error.message : "Error al procesar" },
      { status: 500 }
    );
  }
};
