import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

const DEMO_SHOP = process.env.SEED_SHOP ?? "demo-shop.myshopify.com";
const DEMO_CUSTOMER_ID = process.env.SEED_CUSTOMER_ID ?? "gid://shopify/Customer/1";

async function main() {
  console.log(`Seeding shop=${DEMO_SHOP} customer=${DEMO_CUSTOMER_ID}`);

  await prisma.projectItem.deleteMany({
    where: { environment: { project: { shop: DEMO_SHOP } } },
  });
  await prisma.environment.deleteMany({
    where: { project: { shop: DEMO_SHOP } },
  });
  await prisma.project.deleteMany({ where: { shop: DEMO_SHOP } });

  const customerProject = await prisma.project.create({
    data: {
      shop: DEMO_SHOP,
      customerId: DEMO_CUSTOMER_ID,
      name: "Casa A — Reforma integral",
      shareToken: crypto.randomBytes(32).toString("hex"),
      environments: {
        create: [
          {
            name: "Cocina",
            sortOrder: 0,
            items: {
              create: [
                {
                  productId: "gid://shopify/Product/1001",
                  variantId: "gid://shopify/ProductVariant/2001",
                  quantity: 1,
                  note: "Modelo isla central",
                },
                {
                  productId: "gid://shopify/Product/1002",
                  variantId: "gid://shopify/ProductVariant/2002",
                  quantity: 4,
                  note: "Banquetas tapizadas",
                },
              ],
            },
          },
          {
            name: "Living",
            sortOrder: 1,
            items: {
              create: [
                {
                  productId: "gid://shopify/Product/1003",
                  variantId: "gid://shopify/ProductVariant/2003",
                  quantity: 1,
                },
              ],
            },
          },
          {
            name: "Baño Principal",
            sortOrder: 2,
            items: { create: [] },
          },
        ],
      },
    },
  });

  const salesRepProject = await prisma.project.create({
    data: {
      shop: DEMO_SHOP,
      // No customerId — sales rep created in showroom for a walk-in.
      name: "Cliente Gomez — Showroom 27/04",
      clientName: "Familia Gomez",
      clientEmail: "gomez@example.com",
      clientPhone: "+54 11 5555 5555",
      notes: "Visitaron showroom, definieron paleta clara.",
      environments: {
        create: [
          {
            name: "Dormitorio",
            sortOrder: 0,
            items: {
              create: [
                {
                  productId: "gid://shopify/Product/1004",
                  variantId: "gid://shopify/ProductVariant/2004",
                  quantity: 1,
                },
              ],
            },
          },
        ],
      },
    },
  });

  console.log(`Seeded projects: ${customerProject.id}, ${salesRepProject.id}`);
  console.log(`Customer share link token: ${customerProject.shareToken}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
