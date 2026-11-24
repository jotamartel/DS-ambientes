---
user-invocable: false
name: memory-bank
description: "Persistent project context system for AI agents. Manages project.md and technical.md files in .infracode/memory-bank/"
---

# Skill: Memory Bank

This skill is an internal manual about the Memory Bank system of the Infra AI Framework. It is loaded on demand when the user invokes a Memory Bank command — it is NOT loaded automatically at session start.

---

## 1. What is the Memory Bank

The Memory Bank is a file-based persistent context system for AI agents. It lives in `.infracode/memory-bank/` at the project root and contains two Markdown files with structured information about the project.

It does not depend on external infrastructure: they are Markdown files that the agent reads and writes directly. The goal is to give the agent real project context available in every session without the developer having to re-explain it each time.

---

## 2. `project.md` — Who we are

Contains business and product information. **Almost never changes. Led by the human.**

### Fixed sections (in this order)

```markdown
# Project

## Type
[platform-project | own-product]

## Platform
[Adobe Commerce 2.4.x | Shopify Plus | VTEX IO | VTEX FastStore | N/A]

## Name
[Project or client name]

## Description
[What this project is, one sentence]

## Business Context
[B2B / B2C, what it sells or what problem it solves, client/business particularities relevant to the code]

## Key Constraints
[Important restrictions the agent must respect — e.g.: "do not modify native checkout", "IE11 compatibility"]
```

### Hard rule

**Do NOT modify `project.md` without explicit user approval.** The human knows the business context better. The agent can propose changes, but never apply them without confirmation.

---

## 3. `technical.md` — How we work

Contains technical information that evolves with the project. **Maintained by the agent, evolves with the project.**

### Conditional contract: slim cross-cutting vs. full

The shape of `technical.md` depends on whether the project has a **Module Index** (`.infracode/memory-bank/index.md`). The selector is purely the existence of that file (its contents are not inspected; an empty or header-only index still counts as existing).

- **Mode A — `index.md` EXISTS (slim, cross-cutting only):** `technical.md` carries only cross-cutting technical context. Per-module detail is NOT written here. It is consumed via the **Module Index** (`.infracode/memory-bank/index.md` + `infracode memory get`, following the `memory-search` skill's tier workflow) and recorded via `infracode memory set` (through the platform extraction step) — never written into `technical.md`. In this mode the **Key Modules / Extensions** section is absent from `technical.md`.
- **Mode B — `index.md` DOES NOT exist (full technical context, current behavior):** `technical.md` is the full technical context exactly as today, including the **Key Modules / Extensions** section. In these projects `technical.md` is the agent's only technical context, so nothing is routed elsewhere.

### Fixed sections (Mode B — full template, in this order)

```markdown
# Technical Context

## Stack
[Languages + versions, main frameworks — e.g.: PHP 8.2, Magento 2.4.7, Node 20, React 18]

## Architecture
[How the system is structured — e.g.: headless with FastStore + VTEX IO, Magento monolith + Hyvä theme]

## Key Modules / Extensions
[Critical modules/extensions installed that affect development — e.g.: Amasty_Blog, custom installments module]

## Integrations
[External APIs and services relevant to the code — e.g.: MercadoPago, AFIP, SAP B1, Klevu]

## Conventions
[Patterns and standards the agent must follow — e.g.: PSR-12, BEM for CSS, absolute imports in TS]

## Dev Workflow
[How to run, build, and test locally — e.g.: `warden env up`, `bin/magento setup:upgrade`]

## Key Decisions
[Important technical decisions and why they were made]
```

In **Mode A** the same fixed sections apply MINUS **Key Modules / Extensions**, which is omitted entirely. The `infra-context` skill defines the per-mode section contract in detail.

The agent can propose changes to `technical.md` by showing a diff of the current content vs. the proposed content before applying. The user confirms before any change is written.

---

## 4. When to read each file

- **At session start**: the `memory-bank` rule instructs the agent to read both files (`project.md` and `technical.md`) automatically at the start of each session.
- **If the user mentions recent changes in the project**: re-read `technical.md` to make sure you have the updated context.
- **Before executing any Memory Bank command**: read both files to understand the current state before proposing changes.

---

## 5. When and how to update

### `technical.md`

- Update via `/infra-memory-bank-update` when the stack, architecture, modules, integrations, or conventions change.
- When `.infracode/memory-bank/index.md` exists (Mode A), do NOT write per-module detail into `technical.md` — route it to module-memory via `infracode memory set` (extraction).
- The agent always shows the proposed diff to the user before applying changes.
- Preserve all unmodified sections and the fixed section order.
- If the detected changes amount to a complete rewrite, warn explicitly before proceeding.

### `project.md`

- Only update when the user explicitly requests it.
- Always show the proposed diff before applying.
- If the agent detects that `project.md` might be outdated, mention it as a finding but do NOT propose or apply changes without user instruction.

---

## 6. Available command

`/infra-memory-bank-update` is the **single entry point** for all Memory Bank maintenance. It detects the current state and acts accordingly:

- **First-time init** — when `project.md` / `technical.md` don't exist yet (or are template-only), it delegates to `infra-context` to exhaustively analyze the project and populate both files with real content.
- **Update** — when real content already exists, it detects changes and proposes a diff to `technical.md` before applying.
- **Module extraction** — it also drives the module-documentation flow (delegating to `/infra-memory-update`, which routes to the right per-platform extractor).

This command loads this skill at the start of its execution to operate with the correct context.

---

## 7. PROHIBITED behaviors

- **Modifying `project.md` without explicit user confirmation** — no exception, even if the agent detects that the content is outdated.
- **Deleting sections from any file without warning** — if a section must be deleted, show it in the diff and wait for confirmation.
- **Filling sections with invented content without a basis in the real project code** — if there is not enough information for a section, use the placeholder: `<!-- No sufficient information found. Complete manually. -->`.
- **Assuming information that is not in the Memory Bank files or in the project code** — only document what is verifiable in the project files.
- **Overwriting files with real content without asking first** — if `project.md` or `technical.md` already have real content (not just the template), ask the user before proceeding.
- **Auto-purging a legacy "Key Modules / Extensions" section on update** — when `index.md` exists and `technical.md` still contains that section, do NOT silently delete it; its removal is a separate gated task. The existing diff + GATE + large-rewrite warning safeguard stands.
