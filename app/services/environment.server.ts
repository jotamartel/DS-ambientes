import { z } from "zod";
import prisma from "~/db.server";
import { ProjectsError, type Actor } from "./types";
import {
  assertEnvironmentOwned,
  assertProjectOwned,
  projectScope,
} from "./scope.server";

const NameSchema = z.string().trim().min(1).max(80);

export async function createEnvironment(
  actor: Actor,
  projectId: string,
  input: { name: string },
) {
  await assertProjectOwned(actor, projectId);
  const name = NameSchema.parse(input.name);

  const max = await prisma.environment.aggregate({
    where: { projectId },
    _max: { sortOrder: true },
  });
  const sortOrder = (max._max.sortOrder ?? -1) + 1;

  return prisma.environment.create({
    data: { projectId, name, sortOrder },
    include: { items: true },
  });
}

export async function updateEnvironment(
  actor: Actor,
  environmentId: string,
  input: { name?: string },
) {
  await assertEnvironmentOwned(actor, environmentId);
  const data: { name?: string } = {};
  if (input.name !== undefined) data.name = NameSchema.parse(input.name);

  return prisma.environment.update({
    where: { id: environmentId },
    data,
    include: { items: true },
  });
}

export async function deleteEnvironment(actor: Actor, environmentId: string) {
  await assertEnvironmentOwned(actor, environmentId);
  return prisma.environment.delete({ where: { id: environmentId } });
}

export async function duplicateEnvironment(actor: Actor, environmentId: string) {
  const owned = await assertEnvironmentOwned(actor, environmentId);
  const source = await prisma.environment.findUnique({
    where: { id: owned.id },
    include: { items: true },
  });
  if (!source) throw new ProjectsError("NOT_FOUND", "Environment not found");

  const max = await prisma.environment.aggregate({
    where: { projectId: source.projectId },
    _max: { sortOrder: true },
  });

  return prisma.environment.create({
    data: {
      projectId: source.projectId,
      name: `${source.name} (copia)`,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      items: {
        create: source.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          note: item.note,
        })),
      },
    },
    include: { items: true },
  });
}

const ReorderSchema = z.array(z.string().min(1)).min(1).max(200);

/**
 * Reorder environments within a project. The supplied list MUST contain the
 * full set of environment ids for the project — otherwise the function rejects
 * to avoid leaving environments with overlapping sort orders.
 */
export async function reorderEnvironments(
  actor: Actor,
  projectId: string,
  orderedIds: string[],
) {
  await assertProjectOwned(actor, projectId);
  const ids = ReorderSchema.parse(orderedIds);

  const existing = await prisma.environment.findMany({
    where: { projectId, project: projectScope(actor) },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((e) => e.id));

  if (ids.length !== existingIds.size || !ids.every((id) => existingIds.has(id))) {
    throw new ProjectsError(
      "VALIDATION",
      "Reorder list must contain exactly the project's environment ids",
    );
  }

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.environment.update({
        where: { id },
        data: { sortOrder: index },
      }),
    ),
  );

  return prisma.environment.findMany({
    where: { projectId },
    orderBy: { sortOrder: "asc" },
  });
}
