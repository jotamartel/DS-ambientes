export type Actor =
  | { kind: "customer"; shop: string; customerId: string }
  | { kind: "admin"; shop: string };

export class ProjectsError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  constructor(code: ErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.name = "ProjectsError";
  }
}

export type ErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "VALIDATION"
  | "CONFLICT"
  | "INTERNAL";

const ERROR_STATUS: Record<ErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  VALIDATION: 400,
  CONFLICT: 409,
  INTERNAL: 500,
};

export function isCustomer(actor: Actor): actor is Extract<Actor, { kind: "customer" }> {
  return actor.kind === "customer";
}
