---
user-invocable: false
---

# /infra-memory-update

Single entry point to extract / update the **module documentation** of the Memory Bank. Detects the project's platform and delegates to the right extraction flow. It does NOT duplicate any phase or logic of the destination flows — it only detects, advises, and delegates by reference.

For module extraction always start here. The specialized commands (`/infra-adobe-commerce-memory-extract`, `/infra-vtex-io-memory-extract`, `/infra-memory-extract`) stay directly invocable, but this router picks the correct one for you.

> Scope: this router covers ONLY the module-documentation pipeline (`.infracode/memory-bank/modules.json` + per-module docs via `memory set`/`reindex`). It does NOT touch `project.md`/`technical.md` — those belong to `/infra-memory-bank-update`.

---

## Step 0 — config gate

If `.infracode/config.json` does NOT exist, tell the user the project is not initialized and suggest running `infracode init`, then **stop**. Do not run anything else.

## Step 1 — detect the platform (CLI)

Run:

```bash
infracode memory validate --output json
```

Read `platform`, `hasModules` and (when `hasModules` is `false`) `reason` from the result. `validate` is deterministic and idempotent — the destination flows re-run it themselves as their phase 1, which is fine. Routing keys off `platform`, so a `hasModules: false` with a **recoverable** `reason` (`needs-auth` / `needs-config` / `needs-map`) is NOT a stop here — the destination flow resolves it (gate Bitbucket / bootstrap the map).

## Step 2 — route (hard rule)

Based on `platform`:

- **`platform == "adobe-commerce"`** → follow the instructions of **`/infra-adobe-commerce-memory-extract`** end-to-end. That flow re-runs `validate` as its phase 1 (idempotent), so just hand off to it.
- **`platform == "vtex-io"`** → follow the instructions of **`/infra-vtex-io-memory-extract`** end-to-end. That flow gates the Bitbucket session + project key (its phase -1), then re-runs `validate` as its phase 1 (idempotent), so just hand off to it. VTEX IO apps are remote repos on Bitbucket (each repo = one module).
- **`platform == "generic"`** → follow the instructions of **`/infra-memory-extract`** end-to-end. If the module map is missing, that flow starts with its own phase 0 (map bootstrap with a HARD human gate).
- **any other platform** (e.g. `vtex-faststore`, `shopify`, …) → **advise** the user: "the platform `{platform}` does not have a specialized extraction flow yet" and **propose** continuing with the generic flow. **GATE:** wait for explicit confirmation.
  - With an explicit OK → follow **`/infra-memory-extract`** end-to-end (its phase 0 will help declare the module map if needed).
  - Without an OK (the user declines, stays silent, or is ambiguous) → **terminate** without executing anything and without touching any file.

Note: a project whose declared platform has no local detection but already has a `.infracode/memory-bank/modules.json` map is reported by `validate` as `platform: "generic"` (declared-platform detector first, declared map as fallback) — so on subsequent runs it routes straight through the generic flow without re-prompting.

## Step 3 — delegate, don't duplicate

Once routed, follow the destination command's instructions verbatim. Run the destination flow (adobe-commerce / vtex-io / generic) **end-to-end**. This router does not duplicate the destination flows' extraction logic — but it does add ONE final optional step of its own (Step 4 below): publishing the extracted modules to the memory cloud. When the destination flow finishes, control returns here so that Step 4 runs. Do NOT skip it.

## Step 4 — publish to the memory cloud (gated)

Runs **always** at the end of extraction — whether or not modules changed. There is NO "changed / no-op" guard: the server deduplicates (unchanged modules are skipped server-side), so this step can always be offered.

- Do NOT check whether the cloud is configured: there is always a `base_url` (the memory-cloud default). `infracode memory push` itself reports clearly if the server does not respond or auth fails, and is a no-op when there are no documented modules.
- **GATE**: ask the user "¿Publicar los módulos al memory cloud? (infracode memory push)" and **wait for explicit confirmation**. Never push automatically.
- If approved → run `infracode memory push` and report the summary it returns (created/updated/unchanged, embeddings regenerated/skipped, errors).
- If declined → skip.
- Note: `push` publishes **only the modules** (not `project.md` / `technical.md`).
