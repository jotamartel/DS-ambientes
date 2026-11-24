# /infra-memory-bank-update

Single entry point for all Memory Bank maintenance: initializing for the first time, updating `project.md` / `technical.md`, and running the module extraction flow (which itself offers, via the router, an optional gated publish of the modules to the memory cloud).

## Instructions for the Orchestrator

0. Load the Memory Bank skill from `.agents/skills/memory-bank/SKILL.md`.

1. **Detect the current state** — check whether `.infracode/memory-bank/project.md` and `.infracode/memory-bank/technical.md` exist with real content (not just the template or `<!-- ... -->` placeholders).
   - If neither exists or both are empty/template-only → this is a **first-time init**. Skip the question in step 2 and go directly to step 3.
   - If real content exists → ask the user (step 2).

2. **Ask the user what they want to do:**
   > "¿Qué querés hacer?
   > 1. Actualizar project.md y technical.md (+ extracción de módulos)
   > 2. Solo ejecutar el flujo de extracción de módulos"

   Wait for the user's response before proceeding.
   - Option 1 → continue with step 3.
   - Option 2 → delegate to `/infra-memory-update` and stop.

3. **Module extraction** — delegate to `/infra-memory-update`. The router detects the platform and runs the appropriate extraction flow — including, for `generic`, **bootstrapping the module map** (its phase 0, hard human gate), and for `vtex-io`, **gating the Bitbucket session + project key** (its phase -1). This runs regardless of whether `index.md` already exists.
   - **Do NOT short-circuit on `validate`'s `hasModules: false`.** A `reason` of `needs-map` / `needs-auth` / `needs-config` is **recoverable**: the destination flow resolves it (declare the map / configure Bitbucket) and *then* has modules to extract. Let the flow run. This is precisely why a fresh **generic** project must still go through extraction — `hasModules: false, reason: needs-map` means "bootstrap the map", NOT "nothing to do".
   - Only when the destination flow ends with genuinely nothing to document — a **terminal** `reason: no-modules`, or the user declines a gate — continue to step 4 without `index.md`.

4. **Decide the `technical.md` mode** — check whether `.infracode/memory-bank/index.md` exists (including if just created in step 3):
   - If `index.md` exists → **Mode A (slim)**. Per-module detail lives in module-memory, not in `technical.md`.
   - If `index.md` does NOT exist → **Mode B (full)**. `technical.md` is the full technical context.

5. **Delegate to infra-context** with the following instruction:
   > **If this is a first-time init:** Exhaustively analyze the project. Review: package.json, go.mod, composer.json (if they exist), directory structure, README.md, main configuration files.
   > Produce content for two files respecting exactly the fixed sections:
   > - **project.md**: Type | Platform | Name | Description | Business Context | Key Constraints
   > - **technical.md** — shape matching the mode from step 4 (see below).
   >
   > **If this is an update:** Read the existing `project.md` and `technical.md`. Review the current project state and identify outdated sections of `technical.md`. If `project.md` might be outdated, flag it as a finding but do NOT propose changes to it.
   >
   > **technical.md mode:**
   > - **Mode A (slim)** — Sections: Stack | Architecture | Integrations | Conventions | Dev Workflow | Key Decisions. **OMIT "Key Modules / Extensions" entirely.** If that section exists in the current file, flag it for removal.
   > - **Mode B (full)** — Sections: Stack | Architecture | Key Modules / Extensions | Integrations | Conventions | Dev Workflow | Key Decisions.
   >
   > For sections without sufficient information: `<!-- No sufficient information found. Fill in manually. -->`.
   > **Do not invent content.**

6. **Present proposed changes** to the user:
   - Show proposed content (init) or diff (update).
   - For `project.md` on init: "Review that the business context, platform, and constraints are correct — you know this better than the code does."
   - If "Key Modules / Extensions" is being removed (Mode A): note it explicitly.
   - If changes amount to a full rewrite: warn explicitly.
   - If no changes detected on update: inform "The Memory Bank is up to date. No changes needed."

7. **GATE**: "Do you approve?" — wait for confirmation before writing anything.

8. **Apply changes** if approved:
   - Write (or update) `.infracode/memory-bank/project.md` and `.infracode/memory-bank/technical.md`.
   - On update: preserve unmodified sections and the fixed section order.
   - On update: if the agent flagged `project.md` as outdated, inform the user and only update it if they explicitly request it.

9. On init: if platform indicators were detected during analysis, show:
   `💡 [platform] detected. To install the preset: infracode add github:infracommerce/infracode-presets#platform/[name]`

## Edge cases
- If files do not exist: create them before populating, do not abort.
- If the project has no recognizable files: fill what is possible, mark the rest with the HTML placeholder.
- If the user cancels at the gate: do not modify any file.
