import crypto from "node:crypto";
import { z } from "zod";
import type { Project, Environment, ProjectItem } from "@prisma/client";
import prisma from "~/db.server";
import { ProjectsError, type Actor } from "./types";
import { projectScope, assertProjectOwned } from "./scope.server";

export type ProjectWithEnvironments = Project & {
  environments: (Environment & { items: ProjectItem[] })[];
};

const ProjectInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  clientName: z.string().trim().max(120).optional().nullable(),
  clientEmail: z.string().trim().email().max(160).optional().nullable(),
  clientPhone: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const ProjectUpdateSchema = ProjectInputSchema.partial();

const ListOptionsSchema = z.object({
  archived: z.boolean().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type ProjectInput = z.infer<typeof ProjectInputSchema>;
export type ProjectUpdate = z.infer<typeof ProjectUpdateSchema>;
export type ListOptions = z.input<typeof ListOptionsSchema>;

export async function listProjects(actor: Actor, opts: ListOptions = {}) {
  const { archived, search, page, limit } = ListOptionsSchema.parse(opts);

  const where = {
    ...projectScope(actor),
    ...(archived !== undefined && { archived }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { clientName: { contains: search, mode: "insensitive" as const } },
        { clientEmail: { contains: search, mode: "insensitive" as const } },
      ],
    }),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        environments: {
          include: { items: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.project.count({ where }),
  ]);

  return { projects, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getProject(
  actor: Actor,
  projectId: string,
): Promise<ProjectWithEnvironments> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...projectScope(actor) },
    include: {
      environments: {
        include: { items: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!project) throw new ProjectsError("NOT_FOUND", "Project not found");
  return project;
}

export async function createProject(actor: Actor, input: ProjectInput) {
  const data = ProjectInputSchema.parse(input);
  return prisma.project.create({
    data: {
      shop: actor.shop,
      customerId: actor.kind === "customer" ? actor.customerId : null,
      name: data.name,
      clientName: data.clientName ?? null,
      clientEmail: data.clientEmail ?? null,
      clientPhone: data.clientPhone ?? null,
      notes: data.notes ?? null,
    },
  });
}

export async function updateProject(
  actor: Actor,
  projectId: string,
  input: ProjectUpdate,
) {
  await assertProjectOwned(actor, projectId);
  const data = ProjectUpdateSchema.parse(input);
  return prisma.project.update({
    where: { id: projectId },
    data,
  });
}

export async function archiveProject(actor: Actor, projectId: string) {
  await assertProjectOwned(actor, projectId);
  return prisma.project.update({
    where: { id: projectId },
    data: { archived: true },
  });
}

export async function unarchiveProject(actor: Actor, projectId: string) {
  await assertProjectOwned(actor, projectId);
  return prisma.project.update({
    where: { id: projectId },
    data: { archived: false },
  });
}

export async function deleteProject(actor: Actor, projectId: string) {
  await assertProjectOwned(actor, projectId);
  return prisma.project.delete({ where: { id: projectId } });
}

export async function duplicateProject(actor: Actor, projectId: string) {
  const source = await prisma.project.findFirst({
    where: { id: projectId, ...projectScope(actor) },
    include: {
      environments: {
        include: { items: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!source) throw new ProjectsError("NOT_FOUND", "Project not found");

  return prisma.project.create({
    data: {
      shop: source.shop,
      customerId: source.customerId,
      name: `${source.name} (copia)`,
      clientName: source.clientName,
      clientEmail: source.clientEmail,
      clientPhone: source.clientPhone,
      notes: source.notes,
      environments: {
        create: source.environments.map((env) => ({
          name: env.name,
          sortOrder: env.sortOrder,
          items: {
            create: env.items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId,
              quantity: item.quantity,
              note: item.note,
            })),
          },
        })),
      },
    },
    include: {
      environments: { include: { items: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function generateShareToken(actor: Actor, projectId: string) {
  await assertProjectOwned(actor, projectId);
  const token = crypto.randomBytes(32).toString("hex");
  return prisma.project.update({
    where: { id: projectId },
    data: { shareToken: token },
  });
}

export async function revokeShareToken(actor: Actor, projectId: string) {
  await assertProjectOwned(actor, projectId);
  return prisma.project.update({
    where: { id: projectId },
    data: { shareToken: null },
  });
}

/**
 * Public read-only fetch by share token. Returns null when not found or when
 * the project is archived (archived projects don't expose their share link).
 */
export async function getProjectByShareToken(
  token: string,
): Promise<ProjectWithEnvironments | null> {
  if (!token || token.length < 32) return null;
  const project = await prisma.project.findUnique({
    where: { shareToken: token },
    include: {
      environments: {
        include: { items: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!project || project.archived) return null;
  return project;
}
