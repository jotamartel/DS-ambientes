import { z } from "zod";
import prisma from "~/db.server";
import type { Actor } from "./types";
import { assertEnvironmentOwned, assertItemOwned } from "./scope.server";

const ShopifyGid = z
  .string()
  .trim()
  .regex(/^gid:\/\/shopify\/(Product|ProductVariant)\/\d+$/, "Invalid Shopify GID");

const ProductGid = z
  .string()
  .trim()
  .regex(/^gid:\/\/shopify\/Product\/\d+$/, "Invalid product GID");

const VariantGid = z
  .string()
  .trim()
  .regex(/^gid:\/\/shopify\/ProductVariant\/\d+$/, "Invalid variant GID");

const AddItemSchema = z.object({
  productId: ProductGid,
  variantId: VariantGid,
  // Optional cached handle to skip the /products.json scan on next render.
  productHandle: z.string().trim().min(1).max(200).optional().nullable(),
  quantity: z.number().int().min(1).max(9999).default(1),
  note: z.string().trim().max(500).optional().nullable(),
});

const UpdateItemSchema = z.object({
  quantity: z.number().int().min(1).max(9999).optional(),
  note: z.string().trim().max(500).optional().nullable(),
});

export type AddItemInput = z.input<typeof AddItemSchema>;
export type UpdateItemInput = z.input<typeof UpdateItemSchema>;

export async function addItem(
  actor: Actor,
  environmentId: string,
  input: AddItemInput,
) {
  await assertEnvironmentOwned(actor, environmentId);
  const data = AddItemSchema.parse(input);

  return prisma.projectItem.create({
    data: {
      environmentId,
      productId: data.productId,
      variantId: data.variantId,
      productHandle: data.productHandle ?? null,
      quantity: data.quantity,
      note: data.note ?? null,
    },
  });
}

export async function updateItem(
  actor: Actor,
  itemId: string,
  input: UpdateItemInput,
) {
  await assertItemOwned(actor, itemId);
  const data = UpdateItemSchema.parse(input);
  return prisma.projectItem.update({
    where: { id: itemId },
    data: {
      ...(data.quantity !== undefined && { quantity: data.quantity }),
      ...(data.note !== undefined && { note: data.note }),
    },
  });
}

export async function deleteItem(actor: Actor, itemId: string) {
  await assertItemOwned(actor, itemId);
  return prisma.projectItem.delete({ where: { id: itemId } });
}

/**
 * Move an item to a different environment within projects the actor owns.
 * Useful for drag-and-drop between environments.
 */
export async function moveItem(
  actor: Actor,
  itemId: string,
  toEnvironmentId: string,
) {
  await assertItemOwned(actor, itemId);
  await assertEnvironmentOwned(actor, toEnvironmentId);

  return prisma.projectItem.update({
    where: { id: itemId },
    data: { environmentId: toEnvironmentId },
  });
}
