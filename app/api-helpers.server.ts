import { json } from "@remix-run/node";
import { ProjectsError } from "~/services/types";

/**
 * Read a request body as JSON when Content-Type is application/json,
 * otherwise fall back to URL-encoded form data. Returns a plain object.
 */
export async function parseJsonOrFormBody(request: Request): Promise<Record<string, unknown>> {
  const ct = request.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      return (await request.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  const form = await request.formData();
  const obj: Record<string, unknown> = {};
  form.forEach((value, key) => {
    if (key in obj) {
      const prev = obj[key];
      obj[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
    } else {
      obj[key] = value;
    }
  });
  return obj;
}

export function errorResponse(err: unknown) {
  if (err instanceof ProjectsError) {
    return json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof Response) throw err; // re-throw Remix Responses (auth redirects, etc.)
  // eslint-disable-next-line no-console
  console.error("API error:", err);
  return json({ error: "Internal error" }, { status: 500 });
}
