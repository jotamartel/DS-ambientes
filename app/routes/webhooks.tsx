import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  switch (topic) {
    case "PRODUCTS_UPDATE":
      // Update cached product info in ListItems when a product changes
      if (payload && typeof payload === 'object' && 'id' in payload) {
        const productId = `gid://shopify/Product/${payload.id}`;
        await prisma.listItem.updateMany({
          where: { shopifyProductId: productId },
          data: {
            productTitle: (payload as { title?: string }).title || undefined,
          },
        });
      }
      break;
    case "APP_UNINSTALLED":
      // Clean up shop data on uninstall
      await prisma.session.deleteMany({ where: { shop } });
      await prisma.project.deleteMany({ where: { shop } });
      break;
    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      // Handle GDPR webhooks - no customer data stored in this app
      break;
    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  return new Response();
};
