---
user-invocable: false
name: jira-sync
description: Provides context for agents to work with Jira tickets — pull-first flow (create sessions from tickets), artifact sync (push/pull), and orchestration patterns. CLI reference is discoverable via `infracode jira <cmd> --help`.
---

# Skill: Jira Sync

This skill covers **orchestration patterns** between Jira and SDD sessions. The reference for each subcommand (flags, examples, output schema) is NOT duplicated here — it is in `--help` and discoverable with `--output json`.

---

## Discoverability: rule #1

For ANY Jira command:

```bash
infracode jira --help                    # list all available subcommands
infracode jira <cmd> --help              # flags + examples for the subcommand
infracode jira <cmd> [args] --output json # parseable output
```

Each subcommand has a Cobra `Example:` section with real use cases. Do NOT invent flags or assume output structure — run `--help` and `--output json` when you need them.

**`cli-over-mcp` convention**: for everything Jira-related, use `infracode jira` (not the Atlassian MCP). Operations covered today include comments, attachments, edit, search, worklog, discovery, users, link-types, and more — discover them with `infracode jira --help` and `infracode jira issue --help`.

---

## Status check before operating

Before offering any Jira flow, verify configuration:

```bash
infracode jira status
```

- **Exit 0**: configured, you can offer Jira flows
- **Exit 1**: NOT configured — omit ALL mention of Jira. The SDD flow continues identically to the flow without Jira. Do not suggest commands, do not mention Jira to the user.

Exception: if the user asks how to configure it, suggest `infracode jira login`. Never invoke it yourself (it requires credential input).

---

## Pull-first flow (starting from a Jira ticket)

Applies when the user mentions a `[A-Z]+-[0-9]+` pattern (e.g.: "PROJ-123"). Case-insensitive detection — normalize to uppercase.

1. **Find existing session** with `infracode session list --output json` and filter by `jira_ticket == {TICKET}`. If there is one, offer to resume. If there are several, present the list.
2. **If no session**: `infracode jira issue get {TICKET}` (read-only) → parse `summary` + `description` from the JSON.
3. **Create session**: `infracode session create --feature "{summary}" --jira-ticket {TICKET} --requirement "{description}"`.
4. **Download artifacts**: `infracode jira pull {TICKET} --session {SESSION_ID}`.
5. **Detect phase** based on artifacts present in the directory:
   - No `spec.md` → `spec` phase
   - `spec.md` without `plan.md` → `plan` phase
   - `spec.md` + `plan.md` → `code` phase
   - + `qa-report.md` → `validate` phase
6. **Confirm with the user** before starting the SDD flow from the detected phase.

**Alternative flows**: ticket not found, ticket without artifacts (start from spec mentioning it), user declines (continue without Jira).

---

## When to invoke push automatically

The orchestrator runs `infracode jira push --session {SESSION_ID}` without asking for confirmation at these moments:

1. **Post-spec**: when `spec.md` is approved. If the session has no `jira_ticket`, the CLI offers three options (create ticket, link existing, cancel).
2. **Post-QA PASS**: when `infra-validate` returns PASS and the session has `jira_ticket`.
3. **On user request**: "push to Jira", "sync", etc.

`push` uploads as ticket attachments: `spec.md`, `plan.md`, `tasks.json`, `qa-report.md`, `session.json`. Those that do not exist are skipped. Replaces attachments with the same name.

---

## `--session` convention

**ALWAYS pass `--session {SESSION_ID}` in `push` and `pull`.** The agent knows the SESSION_ID — passing it avoids interactive selectors.

Exception: `infracode jira issue get` and all discovery/read commands (`projects`, `search`, `users search`, etc.) do NOT receive `--session` — they operate at the Jira level without session context.

---

## Rules

1. **Status check first**. If exit 1, omit everything Jira without mentioning it.
2. **Automatic push at the 3 flow moments**. Do not ask for confirmation in post-spec, post-QA PASS, or when the user explicitly requests it.
3. **Always `--session` in push/pull**. Never invoke without that flag.
4. **Do not force linking**. It is optional — linking can happen at the start, when closing the spec, when closing QA, or never.
5. **Do not expose the API token**. If there is an auth error, suggest `infracode jira login` — never ask for the token.
6. **For everything else, `--help`**. Do not memorize flags or examples — discover them at runtime with `infracode jira <cmd> --help` and `--output json`.
