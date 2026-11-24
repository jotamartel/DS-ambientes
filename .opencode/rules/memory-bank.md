# Memory Bank

At the start of each session, read the following project context files:

- `.infracode/memory-bank/project.md` — what the project is (type, platform, business context, constraints)
- `.infracode/memory-bank/technical.md` — how it works (stack, architecture, conventions, integrations)

If any of these files does not exist yet, inform the user and suggest running `/infra-memory-bank-update` to initialize the project's Memory Bank.

## Per-module detail routing

- **If `.infracode/memory-bank/index.md` exists**: `technical.md` holds only cross-cutting context (stack, architecture shape, conventions, dev workflow, project-wide integrations, key decisions, operational runbooks). Per-module detail is consumed via the Module Index — `infracode memory get` plus the progressive tier workflow in the `memory-search` skill — and is recorded via `infracode memory set` (through extraction). Never write per-module detail into `technical.md`.
  - **Index-first, code-last**: when the index exists, it is the MANDATORY first stop for any code/module question. BEFORE reading source files, grepping, or globbing, consult `index.md` (Tier 1), then `infracode memory get "<path|name>" --output json` for the relevant module(s) (Tier 2). Dropping to source code (Tier 3 — read/grep/glob) is allowed ONLY after the index and module docs did not answer the question, or when genuinely more implementation context is needed after having passed through the index. This follows the same progressive tier workflow as the `memory-search` skill.
- **If `.infracode/memory-bank/index.md` does NOT exist**: `technical.md` is the full technical context (current behavior). No routing applies.

## Cross-project (memory cloud)

El memory cloud tiene módulos documentados de OTROS proyectos — incluye reglas
de negocio, integraciones y una sección "Watch Out" con gotchas conocidos.
Consultalo en dos momentos:

1. **Antes de planificar/implementar** una feature o capability nueva → buscá si
   algo similar ya se resolvió en otro proyecto, para reusar el diseño.
2. **Al debuggear un bug o pensar edge cases / casos raros** → buscá si ese
   síntoma, error o gotcha ya apareció (y cómo lo resolvieron) en otro proyecto.

Cómo:

- Corré `infracode memory search "<keywords | error | síntoma>" [--platform <id>] --output json`
  y considerá los resultados relevantes. Hay una URL default, así que no requiere
  configuración previa. `--platform` acota a la misma tecnología.
  Ver la skill `memory-cloud` para el detalle.
- Si el server no responde o la búsqueda falla, seguí sin bloquear (no cortes el flujo por eso).
- Agentes sin shell (p.ej. spec) no corren el search: el orquestador les pasa el
  prior-art / gotchas que encontró al delegar.

Es el complemento cross-project del índice local de arriba (índice = ESTE
proyecto; cloud = OTROS proyectos).
