---
user-invocable: false
---

# /infra-memory-extract

Orchestrates the Memory Bank module-extraction pipeline for **any supported platform** (generic prompt). Runs the deterministic CLI phases of the Eje A surface plus the single LLM reasoning phase, and prints a final report.

This is the **fallback** command for platforms supported by `infracode memory validate`/`extract` that do not have a tuned command of their own, and the driver for **generic / monorepo** projects whose modules are declared in the module map (`.infracode/memory-bank/modules.json`). Platforms with a tuned command must use it instead — for Adobe Commerce / Magento `/infra-adobe-commerce-memory-extract`, for VTEX IO `/infra-vtex-io-memory-extract` — same flow, only the phase-3 prompt (and, where it exists, the deterministic extractor) differs.

Two things set the generic flow apart from Magento:

1. **Phase 0 — module-map bootstrap.** Generic projects have no platform convention, so the module map lives in `.infracode/memory-bank/modules.json`. When that map is missing, this command first helps the user build it (with a HARD human approval gate) before anything else runs.
2. **No deterministic extractor.** For generic, `extract` returns `supported:false` — that is NOT an error. Phase 2 is skipped cleanly, and in phase 3 the agent reads the module's source **directly from its declared `paths`** instead of from an `extract_md` (none is produced or persisted).

## Reparto LLM / CLI (regla dura)

| Phase | Who | Action |
|-------|-----|--------|
| 0. bootstrap (generic, only if map missing) | **LLM** (the agent proposes; the HUMAN approves) | analyze repo → propose module map → **GATE** → persist to `.infracode/memory-bank/modules.json` → re-validate |
| 1. validate | **CLI** (deterministic) | `infracode memory validate --output json` |
| 2. extract | **CLI** (deterministic) | `infracode memory extract --output json` (no deterministic extractor for generic → skipped clean) |
| 3. loop per module (changed + new) | **LLM** (the agent reasons) | `get` → read source from `paths` → generate `documentation_md`/`summary`/`keywords` → `set` |
| 4. reindex | **CLI** (deterministic) | `infracode memory reindex` (stdin JSON) |
| 5. report | **LLM** (the agent) | summarize created/updated/deleted + failed modules; mention if a map was bootstrapped |

**Hard rule.** The agent reasons in phase 0 (proposing the map — never persisting it without the human OK) and phase 3 (documenting). Everything else is a deterministic Eje A subcommand. The agent:

- does **NOT** write Memory Bank files directly (everything goes through `set` / `reindex`),
- does **NOT** write `.infracode/memory-bank/modules.json` without explicit human approval of the proposed map (phase 0).

All subcommand invocations use `--output json`.

---

## Phase 0 — module-map bootstrap (generic only; HARD human gate)

Run phase 1 (`validate`) first. **Only enter this phase** when BOTH hold:

- `validate` returned `hasModules: false` (for a generic project with no map this is `reason: needs-map`), AND
- the project's platform is `generic` (read `platform` from `.infracode/config.json`) **or** the module map file `.infracode/memory-bank/modules.json` is missing or empty.

(For a `hasModules: false` whose `reason` is **not** map-related — e.g. a requiresAuth platform's `needs-auth`/`needs-config`, or a terminal `no-modules` — do NOT bootstrap; apply the phase-1 cut and stop.)

The generic detector is map-driven: with no `.infracode/memory-bank/modules.json` map it returns no modules and the whole pipeline is a clean no-op. This phase builds that map ONCE, with the user's approval.

### (a) Propose the map (LLM)

Analyze the repository to propose the module map. Seed your analysis with:

- **`package.json` workspaces** (root `workspaces` / `pnpm-workspace.yaml`) — each workspace is a strong module candidate.
- **Directory structure** — top-level source groupings (`src/<area>`, `packages/*`, `apps/*`, `services/*`).
- **Memory Bank if it exists** (`.infracode/memory-bank/technical.md`) — it often names the project's modules/areas already.

Propose a map where each module has:

- `name` — a human, vendor-free label.
- `paths` — 1..N repo-relative paths. **`paths[0]` is the primary path = the module's stable identity** in the pipeline (storage, `get`, `set --path`). A logical module MAY cross directories (e.g. `["packages/cli/src/memory", "packages/cli/src/commands/memory"]`).
- one line of **rationale** per module (why these paths form one module).

**Coverage residue (mandatory).** After drafting the map, enumerate EVERY source-bearing directory not covered by any proposed module (top-level dirs and workspace subdirs alike — including tooling like `bin/`, `scripts/`, build pipelines). Classify each one explicitly: (a) add it to a module (propose which), or (b) exclude it with a stated reason (tests, experiments, generated artifacts, vendored code). Tooling and build/release scripts ARE valid modules when they carry real logic. Nothing may be silently omitted.

### (b) HARD human gate — BLOCK for approval

Present the proposed map AND the residue list (excluded dirs + reasons). The user approves inclusions and exclusions alike. Present the proposed map (names + paths + rationale) to the user and **STOP. Wait for explicit approval.**

- You MUST NOT write `.infracode/memory-bank/modules.json` until the user explicitly approves the map.
- If the user requests changes, revise the proposal and present it again — iterate until they approve.
- If the user does NOT approve (declines, or stays silent / ambiguous), **terminate the flow without writing the map file**. Do not partially write. Do not guess.

This gate is non-negotiable: never persist the map on assumption.

### (c) Persist + re-validate (after approval)

Once — and only once — the user approves, write the approved map to `.infracode/memory-bank/modules.json` with this shape:

```json
{
  "modules": [
    { "name": "...", "paths": ["...", "..."] }
  ]
}
```

Then re-run phase 1:

```bash
infracode memory validate --output json
```

It should now return `hasModules: true` with the declared modules. Continue the normal flow from phase 1's cuts.

---

## Phase 1 — validate (CLI)

Run:

```bash
infracode memory validate --output json
```

Parse the result:

```json
{ "platform": "...", "hasModules": true, "modules": { "changed": [], "new": [], "deleted": [] } }
```

When `hasModules` is `false`, the result also carries `reason` (`needs-auth` / `needs-config` / `needs-map` / `no-modules`) — the deterministic cause. Each item in `modules.changed`/`new`/`deleted` is `{ path, name, vendor, paths? }`. For config-driven generic modules, `paths` lists every source directory the module spans (and `paths[0] === path`); for single-path platforms `paths` is absent and the module spans exactly `[path]`.

**Cuts after phase 1:**

- If `platform` is one with a tuned command — `adobe-commerce` → `/infra-adobe-commerce-memory-extract`, `vtex-io` → `/infra-vtex-io-memory-extract` — **stop this generic flow and delegate to that command**. Its phase-3 prompt knows how to read that platform's source (e.g. vtex-io modules are remote Bitbucket repos read via `infracode bitbucket repo files/cat`, NEVER the local filesystem — the generic phase 3 would find nothing on disk). [routing]
- If `hasModules` is `false`, branch on `reason`:
  - **`needs-map`** (generic / map-driven platform with no module map) → go to **Phase 0** (bootstrap the map), then re-validate. [generic]
  - **`needs-auth` / `needs-config`** (a requiresAuth platform reached this generic flow without its Bitbucket gate) → tell the user the actionable cause (run `infracode bitbucket login` / set `bitbucket.{default_workspace, project}`) and **stop**. Do NOT bootstrap a map. (Normally `vtex-io` is routed to its tuned command before this point.)
  - **`no-modules`** (terminal) → tell the user **"no modules to extract for this project"** and **stop**. Do NOT run `extract` and do NOT invoke the LLM (0 LLM tokens, no error). [AC-03]
- If `changed`, `new` and `deleted` are **all three empty** → tell the user **"Memory Bank up to date, no modules to extract"** and **stop**. Do NOT run `extract` and do NOT invoke the LLM (0 LLM tokens). [AC-04]
- **Only `deleted` (no `changed`/`new`)** → do **NOT** stop. Skip phase 3 (there is nothing to document) and go to phase 4 (reindex) to clean up the DELETED modules. [edge case]
- Otherwise → continue to phase 2.

---

## Phase 2 — extract (CLI)

Run the general extractor (no `--path`). It runs over **ALL** detected modules — it is cheap and deterministic:

```bash
infracode memory extract --output json
```

Parse `ExtractAllResult`:

```json
{ "platform": "...", "supported": true, "extracted": [{ "path": "...", "module": "...", "module_file": "...", "xrefs": 0, "persisted": true }], "failed": [{ "path": "...", "error": "..." }], "total_xrefs": 0 }
```

**No deterministic extractor (generic):** for platforms without a structural extractor, `extract` returns `{ "supported": false, "extracted": [], "failed": [], "total_xrefs": 0 }` with **exit code 0**. This is **NOT an error** — there is simply no structural skeleton to build. **Skip phase 2 cleanly**, inform the user ("no deterministic extractor for this platform; phase 3 reads source directly"), and go to phase 3. Phase 3 will read each module's source from its `paths`.

**Cuts / handling after phase 2 (platforms WITH an extractor, e.g. Magento via the tuned command):**

- **Docker unavailable** (exit code != 0; in `--output json` stderr carries `{ "error": "docker-unavailable", "reason", "message", "hint" }`): tell the user the **clear reason** and **stop** without invoking the LLM. The `reason` is one of `no-compose-file`, `docker-not-running`, `php-not-running`. [AC-06]
- **All modules failed** (exit code != 0 because `extracted.length === 0 && failed.length > 0`): tell the user and **stop** before phase 3. [edge case]
- **Partial failures** (`failed[]` non-empty but `extracted[]` non-empty): note the `failed` modules (path + error) for the final report and **skip them** in phase 3. Continue with the rest. [AC-14]

---

## Phase 3 — loop per module: LLM reasoning (incremental)

The LLM documentation phase is **incremental**: only `changed` + `new` from phase 1. For **each module in `changed` + `new`** that is NOT in `extract`'s `failed[]`, run the loop below (get → reason → set).

**At scale, fan out.** With many modules — or large source trees — processing them all in a single context is impractical. You MAY split the module list into batches and dispatch one sub-agent per batch, each running the same get → reason → set loop independently. This parallelizes safely: every `set` writes a distinct per-module file. For just a handful of modules, run the loop inline yourself.

### (a) Read the module record (CLI)

```bash
infracode memory get <path> --output json
```

Returns the full record: identity/metadata fields, `paths` (every source directory the module spans), `extract_md` (string or null — for generic it is **null**, no structural extractor), `documentation_md` (previous, may be empty), `summary`, `keywords`. Use `<path>` = the module's primary path (`paths[0]`) from validate.

### (b) Generate the documentation (LLM — generic prompt)

> For each module you have its record from `get`, including its `paths`. Generic projects have **no `extract_md`** (no deterministic extractor), so your reasoning input is the **module's source, read directly from its `paths`**.
>
> Read the source under each path in the module's `paths` (the module may span several directories). Be targeted in your *analysis* — but the inventories below must be **complete, not sampled**: they are what makes the doc useful as a reference. Complement with the previous `documentation_md` (if any) so you refine rather than restart.
>
> **Guiding rule:** after reading this doc, an agent should rarely need to read the module's code (Tier 3); when it does, the File map must tell it exactly which file to open.
>
> Produce:
> - **`documentation_md`** — markdown with these sections (omit a section only when it truly has nothing; never invent):
>   1. **Purpose & behavior** — what the module does, functional/business view.
>   2. **Public surface** — exhaustive: commands, exported entry points, what the rest of the system consumes.
>   3. **External integrations** — exhaustive: APIs consumed (method + route/endpoint), services, protocols.
>   4. **Configuration** — files and keys it reads and writes.
>   5. **Key types/contracts** — shapes that cross the module boundary.
>   6. **Business rules & invariants** — limits, idempotency, ordering, error policies.
>   7. **File map** — each significant file with one line of responsibility (the Tier-3 door).
>   8. **Things to watch out for** — gotchas, historical pitfalls, deliberate non-features.
> - **`summary`**: one functional sentence.
> - **`keywords`**: a list of search terms (array or CSV; `set` normalizes both).

### (c) Persist via set (CLI)

The functional `documentation_md` is rich, multi-line markdown, so pipe it RAW on stdin with `--documentation-md-stdin` and pass the short fields as flags. This needs no JSON escaping and never a temp file — do NOT write the payload to `/tmp` or anywhere else, pipe it directly:

```bash
infracode memory set \
  --path "<path>" \
  --summary "<one sentence>" \
  --keywords "<kw1>, <kw2>, <kw3>" \
  --documentation-md-stdin --output json <<'DOCUMENTATION_MD'
<the full functional documentation_md markdown — multi-line, verbatim, no escaping>
DOCUMENTATION_MD
```

There is no commit flag — the CLI derives the per-module commit watermark itself (`lastCommitForPath`), computed over **all** the module's `paths` (a commit touching any of them bumps the watermark). Do NOT pass `name`/`vendor`/`platform`/`commit_hash`/`updated_at`/`paths` — the CLI derives them and ignores them if present. [AC-18]

(Legacy fallback: `echo '{ "path": ..., "documentation_md": ..., "summary": ..., "keywords": ... }' | infracode memory set --output json` still works, but you must JSON-escape the markdown — prefer the `--documentation-md-stdin` form above.)

**If a `set` fails** (exit != 0, e.g. minimum module contract incomplete): note the module as failed (path + error) for the report and **continue with the rest**. Do NOT abort the pipeline. [AC-13]

For generic there is no `extract_md` to preserve; `set` only persists `documentation_md` / `summary` / `keywords` (plus the derived watermark and `paths`).

---

## Phase 4 — reindex (CLI)

Run `reindex`, passing the run data via **stdin JSON**. `reindex` ONLY consolidates the global `index.md` (summary + keywords per module) and clears DELETED modules from storage + index. It does **NOT** bump any commit.

```bash
echo '{ "deleted": [{ "path": "<path>", "name": "<name>", "vendor": "<vendor|null>" }], "created": <count>, "updated": <count> }' \
  | infracode memory reindex --output json
```

- `created` / `updated` = the **count** (number) of modules you successfully `set` in phase 3 (new vs already-existing). NOT arrays of paths.
- `deleted` = the `modules.deleted` **items** from phase 1, forwarded verbatim as `{ path, name, vendor }` objects (NOT just paths — the reindexer needs name/vendor to locate the deleted module's storage).

Parse `ReindexResult`:

```json
{ "created": 0, "updated": 0, "deleted": 0 }
```

`reindex` deletes the DELETED modules and regenerates the global `index.md`. [AC-08]

---

## Report (LLM)

Present a readable summary to the user:

- whether a module map was **bootstrapped** this run (phase 0: map created + persisted to `.infracode/memory-bank/modules.json`),
- modules **created** / **updated** / **deleted** (from `ReindexResult`),
- the list of **failed** modules — both from `extract` (`failed[]`, platforms with an extractor) and from `set` — each with its reason.

[AC-09]
