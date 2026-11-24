---
user-invocable: false
name: memory-search
description: "Progressive module discovery using the project memory index. Use when the agent needs to understand what specific modules do before planning, specifying, or implementing."
---

# Skill: Memory Search

Use the module index to discover and understand parts of the project without reading all the source code. The system has three levels of detail — start with the lightest and go deeper only if you need more.

---

## Prerequisite

The index must exist before using it:

```bash
ls .infracode/memory-bank/index.md
```

- **Exists** → follow the workflow below.
- **Does not exist** → check the platform in `.infracode/config.json`:
  - **Magento (`adobe-commerce`)**: warn the user that the module index is missing and suggest running `infracode memory extract`. Then fall back to exploring the codebase directly (Read/Grep/Glob).
  - **Any other platform or no config**: silently fall back to exploring the codebase directly. The index is not expected to exist for all projects.

---

## Workflow: progressive discovery

### Tier 1 — Read the index (cheapest)

```
Read .infracode/memory-bank/index.md
```

A flat Markdown file listing **all** modules in the project. Each entry has:

```markdown
## module-name
**Path:** path/to/module
**Keywords:** keyword1, keyword2, ...
One-sentence functional summary.
```

Scan the keywords and summaries to identify which modules are relevant to your task. In most cases, this tier is enough to know **what exists** and **where to look**.

The index may also contain a **## Vendor modules (shared cache)** block: a lightweight manifest of the third-party (`vendor/`) modules this project uses (key + summary). It is a POINTER — the full documentation is NOT local; fetch it from the cloud with `infracode memory show <id>` (or `infracode memory search`). Do not confuse it with the project's own `app/code` modules listed above.

**When to go to Tier 2:** when you need to understand the detailed behavior, business rules, integrations, or gotchas of a specific module.

### Tier 2 — Read extracted documentation for a module

```bash
infracode memory get "<path|name>" --output json
```

`get` accepts **either** the module path **or** its name/label exactly as it appears in `index.md`:

```bash
# by path (the `**Path:**` line in the index)
infracode memory get "app/code/Vendor/Checkout" --output json

# by name/label (the `## <name>` heading in the index)
infracode memory get "Vendor_Checkout" --output json
infracode memory get "Memory Bank Engine" --output json
```

Returns a JSON object with:

- **`documentation_md`** — LLM-generated functional documentation:
  - Summary, What It Does, Site Areas Affected, Integrations, Business Rules, Watch Out (empty sections omitted)
- **`extract_md`** (Magento only, may be null) — deterministic structural extract from a PHP tokenizer:
  - Dependencies, plugins, preferences, injections, observers, routes, cron jobs, DB tables, queues, email templates, JS overrides, layout modifications, class signatures, and cross-references ("Modified By" sections)

When `extract_md` is present, it gives you the precise technical structure; `documentation_md` gives you the functional explanation. Together they cover most spec and planning questions without reading source code.

**When to go to Tier 3:** when you need to see the concrete implementation — a specific function, type, interface, or control flow logic.

### Tier 3 — Read the module source code

Use Read, Grep, and Glob directly on the module's files. This is the most expensive level in terms of context — use it only when the previous tiers don't answer your question.

---

## Rules

1. **Don't skip tiers** — always start with `index.md`. Don't jump straight to reading code if you can resolve your question with the index or extracted documentation.
2. **Always `--output json`** for `infracode memory get` — project-wide rule.
3. **Don't invent content** — if a module doesn't appear in the index, it may not have been extracted yet. Suggest `infracode memory extract` to the user. Don't assume you know what it does.
4. **Stale index** — if a module exists in the filesystem but not in the index, the index may be outdated. Mention this to the user.
5. **Path or name must be exact** — `infracode memory get` accepts the path or the name/label exactly as stored in the index. Don't invent partial paths, partial names, or variants.
