import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { z } from "zod";
import { errorResponse, parseJsonOrFormBody } from "~/api-helpers.server";
import { customerActor } from "~/shopify-integration/actor.server";
import {
  createProjectFile,
  listProjectFiles,
  requestStagedUpload,
} from "~/services/file.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const actor = customerActor(request);
    const files = await listProjectFiles(actor, params.id!);
    return json({ files });
  } catch (err) {
    return errorResponse(err);
  }
}

const Intent = z.enum(["staged-upload", "create"]);

const UploadInputSchema = z.object({
  fileName: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});

const CreateInputSchema = UploadInputSchema.extend({
  resourceUrl: z.string().trim().min(1),
});

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  try {
    const actor = customerActor(request);
    const projectId = params.id!;
    const body = await parseJsonOrFormBody(request);
    const intent = Intent.safeParse(body.intent);
    if (!intent.success) return json({ error: "Intent inválido" }, { status: 400 });

    switch (intent.data) {
      case "staged-upload": {
        const input = UploadInputSchema.parse({
          fileName: body.fileName,
          mimeType: body.mimeType,
          sizeBytes: Number(body.sizeBytes),
        });
        const target = await requestStagedUpload(actor, projectId, input);
        return json({ target });
      }
      case "create": {
        const input = CreateInputSchema.parse({
          fileName: body.fileName,
          mimeType: body.mimeType,
          sizeBytes: Number(body.sizeBytes),
          resourceUrl: body.resourceUrl,
        });
        const file = await createProjectFile(actor, projectId, input);
        return json({ file }, { status: 201 });
      }
    }
  } catch (err) {
    return errorResponse(err);
  }
}
