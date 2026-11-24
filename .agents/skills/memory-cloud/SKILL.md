---
user-invocable: false
name: memory-cloud
description: "Use to QUERY the remote memory cloud (cross-project knowledge, modules documented in OTHER projects) before planning or implementing, and to PUBLISH this project's local Memory Bank to the cloud. For THIS project's LOCAL module index, use memory-search instead."
---

# Skill: Memory Cloud

The memory cloud is a **remote, hosted** server (Bun + Postgres, hybrid FTS + vector search) holding modules documented across **multiple projects**. Use it to discover how something was already solved in **another** project and reuse that design/knowledge, and to publish this project's Memory Bank so others benefit.

This is **not** the same as `memory-search`. `memory-search` is the **LOCAL** module index of **THIS** project (via `infracode memory get`). They answer different questions:

| Question | Skill |
|---|---|
| Knowledge from OTHER projects / cross-project reuse | **memory-cloud** (this skill) |
| Modules of THIS project | **memory-search** |

When in doubt about a module that belongs to the current repo, go to `memory-search` first.

---

## Connection (default URL — no setup needed)

memory-cloud has a built-in default `base_url`, so `search` / `show` / `push` work **out-of-the-box** — no `configure` required, and there is NO "not configured" error.

- `infracode memory configure [--base-url <url>]` is an **optional override** of the URL (e.g. to point at a local/staging server); it probes `GET /health` and persists to `~/.infracode/memory-cloud.json`. Never run it yourself — it's a user choice.
- The Bearer **always** comes from the gateway credential (`~/.infracode/gateway.json`, via `infracode gateway`). If there's no gateway credential (or `auth_token` is empty), no `Authorization` header is sent (works with a server on `AUTH_ENABLED=false`).
- If the server is unreachable or auth fails, the command reports it clearly (network / auth error) — it never silently misleads.

> For local use, the server is brought up from its own repo `ifclatam-dcp/memory-cloud` with `bin/mem up`, served at `http://localhost:3100`.

---

## Querying (proactive, cross-project)

**When:** before planning, specifying, or implementing a feature, search the cloud to see if something similar was already solved in **another** project, so you can reuse the design/knowledge.

**How:**

```bash
infracode memory search "<query>" [--project <name>] [--platform <id>] [--limit <n>] --output json
```

Full-text / hybrid search over the cloud's modules. Returns parseable JSON with each module's `id` (UUID). `--project` filters by project name; `--platform` filters by the module's platform (e.g. `adobe-commerce`, `vtex-io`) and combines with `--project` via AND; `--limit` caps results. 0 results → proceed normally.

The search is cross-project and combines **project modules** (from ANY project in the cloud, each with its `project_name`) and shared **vendor modules** (third-party `vendor/` modules, no owning project, keyed by `name@version`), each tagged `scope: "project" | "vendor"`. A vendor module appears once — collapsed by name, represented by its latest version — with a `versions_count`. `show <id>` returns the full detail of either kind alike.

```bash
infracode memory show <id> --output json
```

Full detail of a module by its UUID (the `id` returned by `search`), including `documentation_md` (and `extract_md` when present). This is the **remote** counterpart of `memory get`.

`search` / `show` are **pure reads** — they NEVER write to disk or to the local Memory Bank. Use the results to inform the design/reuse, but **adapt** to THIS project's context. Do not copy blindly.

---

## Pushing (after updating the Memory Bank)

**When:** after an `infracode memory extract` / `reindex` that updated the local Memory Bank, **suggest** publishing to the cloud to keep it fresh. Suggest it — do not run it without the user knowing.

**How:**

```bash
infracode memory push
```

Publishes the locally **documented** modules to the cloud (`POST /v1/memory/modules`, one POST per module). Behavior:

- Only documented modules are published; non-documented ones are skipped and counted in `skipped`.
- In-place progress while running, then a single aggregated summary (totals created / updated / unchanged, embeddings regenerated / skipped, errors).
- Upsert-only and idempotent (no prune, no `deleted`).
- On an auth error (401/403) it aborts immediately; other per-module errors are recorded and the loop continues.

---

## Vendor modules (cross-project, keyed by name@version)

A Magento project's THIRD-PARTY modules (those under `vendor/`, not the native `magento/*` nor the project's own `app/code`) are documented ONCE and reused across projects, keyed by the immutable `name@version` (first-writer-wins). They live in the cloud alongside project modules and show up in `search` with `scope: "vendor"`.

Surface (deterministic subcommands, orchestrated by the `/infra-adobe-commerce-vendor-extract` command — do not run them piecemeal by hand):

- `infracode memory vendor-scan` — inventory `composer.lock` third parties + exact dedup against the cloud.
- `infracode memory vendor-extract` — structural extract of `vendor/<name>`.
- `infracode memory vendor-set` / `vendor-push` — persist the doc / upload it (first-writer-wins).
- `infracode memory vendor-index` — write a lightweight manifest of the project's vendor modules into `index.md`.

To simply CONSUME a vendor module's doc (e.g. a dependency of a project module), just `search` + `show` — no need to touch the vendor pipeline.

---

## Rules

1. **Always `--output json`** when the result is processed programmatically (project-wide rule).
2. **Don't invent module content** — if there are no results, say so. Don't assume.
3. **`search` / `show` are read-only** — they never write to the local Memory Bank or disk.
4. **FTS-only degradation** — if the server runs without an embeddings gateway, search degrades to FTS-only (weaker semantics, but keyword matching still works). Mention this when relevant.
5. **The `id` for `show` is the exact UUID returned by `search`** — never invent ids or paths.
