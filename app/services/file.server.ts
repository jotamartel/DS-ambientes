import prisma from "~/db.server";
import { ProjectsError, type Actor } from "./types";
import { assertProjectOwned } from "./scope.server";
import {
  createStagedUpload,
  deleteShopifyFile,
  finalizeFileUpload,
  isAllowedMime,
  FILE_MAX_BYTES,
  type StagedTarget,
} from "~/shopify-integration/files.server";

export async function listProjectFiles(actor: Actor, projectId: string) {
  await assertProjectOwned(actor, projectId);
  return prisma.projectFile.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });
}

export async function requestStagedUpload(
  actor: Actor,
  projectId: string,
  input: { fileName: string; mimeType: string; sizeBytes: number },
): Promise<StagedTarget> {
  await assertProjectOwned(actor, projectId);
  validateUpload(input);
  return createStagedUpload(actor.shop, {
    fileName: input.fileName,
    mimeType: input.mimeType as Parameters<typeof createStagedUpload>[1]["mimeType"],
    sizeBytes: input.sizeBytes,
  });
}

export async function createProjectFile(
  actor: Actor,
  projectId: string,
  input: {
    resourceUrl: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  },
) {
  await assertProjectOwned(actor, projectId);
  validateUpload(input);
  if (!input.resourceUrl || typeof input.resourceUrl !== "string") {
    throw new ProjectsError("VALIDATION", "resourceUrl is required");
  }

  const created = await finalizeFileUpload(actor.shop, {
    resourceUrl: input.resourceUrl,
    fileName: input.fileName,
    mimeType: input.mimeType as Parameters<typeof finalizeFileUpload>[1]["mimeType"],
  });

  return prisma.projectFile.create({
    data: {
      projectId,
      shopifyFileId: created.id,
      fileName: input.fileName,
      url: created.url,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
    },
  });
}

export async function deleteProjectFile(
  actor: Actor,
  projectId: string,
  fileId: string,
) {
  await assertProjectOwned(actor, projectId);
  const file = await prisma.projectFile.findFirst({
    where: { id: fileId, projectId },
  });
  if (!file) throw new ProjectsError("NOT_FOUND", "File not found");

  await prisma.projectFile.delete({ where: { id: file.id } });
  await deleteShopifyFile(actor.shop, file.shopifyFileId);
  return { ok: true };
}

function validateUpload(input: { fileName: string; mimeType: string; sizeBytes: number }) {
  if (!input.fileName || input.fileName.length > 240) {
    throw new ProjectsError("VALIDATION", "Invalid file name");
  }
  if (!isAllowedMime(input.mimeType)) {
    throw new ProjectsError("VALIDATION", "Tipo de archivo no permitido. Solo imágenes y PDF.");
  }
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > FILE_MAX_BYTES) {
    throw new ProjectsError("VALIDATION", `El archivo supera el tamaño máximo de ${FILE_MAX_BYTES / 1024 / 1024} MB.`);
  }
}
