import { adminGraphqlQuery } from "./admin.server";
import { ProjectsError } from "~/services/types";

export const FILE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const FILE_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;

export type AllowedMime = (typeof FILE_ALLOWED_MIME)[number];

export type StagedTarget = {
  url: string;
  resourceUrl: string;
  parameters: Array<{ name: string; value: string }>;
};

const STAGED_UPLOADS_MUTATION = /* GraphQL */ `
  mutation StagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }
`;

const FILE_CREATE_MUTATION = /* GraphQL */ `
  mutation FileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        ... on MediaImage {
          image { url }
        }
        ... on GenericFile {
          url
        }
      }
      userErrors { field message }
    }
  }
`;

const FILE_QUERY = /* GraphQL */ `
  query FileNode($id: ID!) {
    node(id: $id) {
      ... on MediaImage {
        id
        fileStatus
        image { url }
      }
      ... on GenericFile {
        id
        fileStatus
        url
      }
    }
  }
`;

const FILE_DELETE_MUTATION = /* GraphQL */ `
  mutation FileDelete($fileIds: [ID!]!) {
    fileDelete(fileIds: $fileIds) {
      deletedFileIds
      userErrors { field message }
    }
  }
`;

/**
 * Returns true if the MIME type is one we accept for project files.
 */
export function isAllowedMime(mime: string): mime is AllowedMime {
  return (FILE_ALLOWED_MIME as readonly string[]).includes(mime);
}

/**
 * Step 1 of the upload: ask Shopify for a staged upload target so the client
 * can POST the file bytes directly to Google Cloud Storage. Avoids streaming
 * the file body through our serverless function (Vercel has body size limits).
 */
export async function createStagedUpload(
  shop: string,
  input: { fileName: string; mimeType: AllowedMime; sizeBytes: number },
): Promise<StagedTarget> {
  const isImage = input.mimeType.startsWith("image/");
  const data = await adminGraphqlQuery<{
    stagedUploadsCreate: {
      stagedTargets: StagedTarget[];
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(shop, STAGED_UPLOADS_MUTATION, {
    input: [
      {
        filename: input.fileName,
        mimeType: input.mimeType,
        httpMethod: "POST",
        resource: isImage ? "IMAGE" : "FILE",
        fileSize: String(input.sizeBytes),
      },
    ],
  });
  const errs = data.stagedUploadsCreate.userErrors;
  if (errs.length) {
    throw new ProjectsError("INTERNAL", `stagedUploadsCreate: ${errs.map((e) => e.message).join("; ")}`);
  }
  const target = data.stagedUploadsCreate.stagedTargets[0];
  if (!target) {
    throw new ProjectsError("INTERNAL", "stagedUploadsCreate returned no targets");
  }
  return target;
}

type CreatedFile = { id: string; url: string };

/**
 * Step 2: after the client uploads to the staged target, register the file
 * with Shopify Files. Polls until the file is ready (URL becomes available)
 * up to ~6 seconds. If polling times out we still return the file id with
 * the staged resourceUrl as a fallback — the UI will show the file but the
 * preview may take a moment to become available.
 */
export async function finalizeFileUpload(
  shop: string,
  input: { resourceUrl: string; fileName: string; mimeType: AllowedMime },
): Promise<CreatedFile> {
  const isImage = input.mimeType.startsWith("image/");
  const data = await adminGraphqlQuery<{
    fileCreate: {
      files: Array<{
        id: string;
        fileStatus: string;
        image?: { url: string } | null;
        url?: string | null;
      }>;
      userErrors: Array<{ field: string[] | null; message: string }>;
    };
  }>(shop, FILE_CREATE_MUTATION, {
    files: [
      {
        originalSource: input.resourceUrl,
        contentType: isImage ? "IMAGE" : "FILE",
        filename: input.fileName,
      },
    ],
  });
  const errs = data.fileCreate.userErrors;
  if (errs.length) {
    throw new ProjectsError("INTERNAL", `fileCreate: ${errs.map((e) => e.message).join("; ")}`);
  }
  const created = data.fileCreate.files[0];
  if (!created?.id) {
    throw new ProjectsError("INTERNAL", "fileCreate returned no file");
  }

  const initial = pickUrl(created);
  if (initial) return { id: created.id, url: initial };

  for (let attempt = 0; attempt < 6; attempt++) {
    await sleep(1000);
    const node = await adminGraphqlQuery<{
      node:
        | { id: string; fileStatus: string; image?: { url: string } | null; url?: string | null }
        | null;
    }>(shop, FILE_QUERY, { id: created.id });
    const url = pickUrl(node.node);
    if (url) return { id: created.id, url };
  }

  return { id: created.id, url: input.resourceUrl };
}

function pickUrl(
  node: { image?: { url: string } | null; url?: string | null } | null,
): string | null {
  if (!node) return null;
  return node.image?.url ?? node.url ?? null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Best-effort deletion from Shopify Files. We swallow errors so a failed
 * remote delete doesn't block removing the local DB record — the file would
 * become orphaned in Shopify Files but the project would still look clean.
 */
export async function deleteShopifyFile(shop: string, fileId: string): Promise<void> {
  try {
    await adminGraphqlQuery(shop, FILE_DELETE_MUTATION, { fileIds: [fileId] });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("fileDelete failed for", fileId, err);
  }
}
