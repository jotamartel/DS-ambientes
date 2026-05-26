import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SHOP = process.env.SHOP;

async function main() {
  if (!SHOP) throw new Error("SHOP env var required");
  console.log(`Backfilling productHandle from ${SHOP}`);

  const items = await prisma.projectItem.findMany({
    where: { productHandle: null },
    select: { id: true, variantId: true },
  });
  if (items.length === 0) {
    console.log("Nothing to backfill.");
    return;
  }
  const uniqueVariants = new Set(items.map((i) => i.variantId));
  console.log(`Found ${items.length} items without handle (${uniqueVariants.size} unique variants)`);

  // Scan the catalog once, build numericVariantId → productHandle map.
  const handleByVariant = new Map<string, string>();
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`https://${SHOP}/products.json?limit=250&page=${page}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      console.error(`Page ${page}: HTTP ${res.status}, stopping`);
      break;
    }
    const body = (await res.json()) as {
      products: Array<{ handle: string; variants: Array<{ id: number }> }>;
    };
    if (body.products.length === 0) break;
    for (const p of body.products) {
      for (const v of p.variants) {
        handleByVariant.set(String(v.id), p.handle);
      }
    }
    process.stdout.write(`  page ${page}: ${body.products.length} products (cumulative variants: ${handleByVariant.size})\n`);
    if (body.products.length < 250) break;
  }

  // Update each item with its handle.
  let updated = 0;
  let missed = 0;
  for (const item of items) {
    const m = item.variantId.match(/\/ProductVariant\/(\d+)$/);
    const numericId = m?.[1];
    if (!numericId) {
      missed++;
      continue;
    }
    const handle = handleByVariant.get(numericId);
    if (!handle) {
      missed++;
      continue;
    }
    await prisma.projectItem.update({
      where: { id: item.id },
      data: { productHandle: handle },
    });
    updated++;
  }

  console.log(`\nDone. Updated ${updated} items, missed ${missed} (variant not in catalog).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
