import type { Prisma } from "@prisma/client";
import prisma from "~/db.server";
import { ProjectsError, type Actor } from "./types";

/**
 * Build the WHERE clause that scopes Project queries to the actor.
 * Customers see only projects they own; admins see everything in their shop.
 */
export function projectScope(actor: Actor): Prisma.ProjectWhereInput {
  if (actor.kind === "customer") {
    return { shop: actor.shop, customerId: actor.customerId };
  }
  return { shop: actor.shop };
}

/**
 * Verify the actor owns/can access the given project. Returns the project id
 * on success, throws NOT_FOUND otherwise. We use NOT_FOUND (not FORBIDDEN) to
 * avoid leaking the existence of projects across customers.
 */
export async function assertProjectOwned(
  actor: Actor,
  projectId: string,
): Promise<string> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectScope(actor) },
    select: { id: true },
  });
  if (!project) throw new ProjectsError("NOT_FOUND", "Project not found");
  return project.id;
}

/**
 * Find an environment scoped to the actor (via project relation).
 * Returns the environment + its projectId, or throws NOT_FOUND.
 */
export async function assertEnvironmentOwned(
  actor: Actor,
  environmentId: string,
): Promise<{ id: string; projectId: string }> {
  const env = await prisma.environment.findFirst({
    where: { id: environmentId, project: projectScope(actor) },
    select: { id: true, projectId: true },
  });
  if (!env) throw new ProjectsError("NOT_FOUND", "Environment not found");
  return env;
}

export async function assertItemOwned(
  actor: Actor,
  itemId: string,
): Promise<{ id: string; environmentId: string }> {
  const item = await prisma.projectItem.findFirst({
    where: { id: itemId, environment: { project: projectScope(actor) } },
    select: { id: true, environmentId: true },
  });
  if (!item) throw new ProjectsError("NOT_FOUND", "Item not found");
  return item;
}
