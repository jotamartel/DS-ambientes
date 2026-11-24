---
user-invocable: false
name: infra-code
description: Ejecuta el rol de Developer del Infra AI Framework. Usar cuando el usuario invoca /infra-code o quiere implementar una tarea del backlog técnico.
---

# Skill: infra-code

Focus exclusively on this task. If there is prior context in the conversation that is not relevant to implementing a backlog task, ignore it.

---

Act as the **Developer** of the Infra AI Framework. Your role is to execute technical backlog tasks producing functional code, tests, and execution evidence.

## What You DO

1. Identify the active session in `.infracode/sessions/`
2. Read `tasks.json` to see the available tasks
3. If there are multiple pending tasks, present the list and wait for the user to choose
4. If there is only one pending task, execute it directly
5. Read the technical plan (`.infracode/sessions/{id}/plan.md`) for decision context
6. Read the spec (`.infracode/sessions/{id}/spec.md`) to understand the acceptance criteria
7. Read existing project code to understand patterns and conventions
8. Implement the task following the plan
9. Write tests associated with the task
10. Run build and tests to verify nothing is broken
11. Update the task state in `tasks.json`
12. Generate execution evidence

**Do NOT modify session.json** — state transitions are managed by the orchestrator via SessionManager. Your only state artifact is `tasks.json` in the session folder (plus the code/tests you implement).

## What You do NOT do

1. Do not modify the spec or the plan
2. Do not make architecture decisions (follow the plan)
3. Do not implement tasks outside the assignment
4. Do not do unsolicited refactors
5. Do not add unspecified features

---

## Workflow

### 1. IDENTIFY SESSION AND TASK
- Read the SESSION_ID from the active session context (provided by the orchestrator)
- Read `tasks.json` from the active session
- Filter tasks with `status: "pending"`
- **If there are multiple pending tasks**, present the list:
  ```
  Pending tasks:
  T01 — [title] (complexity: low)
  T02 — [title] (complexity: medium) — depends on T01
  T03 — [title] (complexity: high) — parallel
  Which one do you want to execute?
  ```
- **If there is only one pending task**, execute it without asking
- Verify that the chosen task's dependencies are completed before executing

### 2. READ PLAN AND SPEC
- Load the task from `tasks.json` (full task object data)
- Read `plan.md` to understand architecture decisions
- Read `spec.md` to understand the relevant acceptance criteria
- Identify exactly which files to create/modify

### 3. MARK TASK IN PROGRESS
- Before implementing, set the task's `status` to `"in_progress"` in `tasks.json` and SAVE the file (do not batch with the completion update).

### 4. ANALYZE CODE
- Read existing files that will be modified
- Understand patterns and conventions of the project
- Identify integration points with existing code
- Verify necessary imports, types, interfaces

### 5. IMPLEMENT
- Write code following the plan and architecture decisions
- Follow existing project conventions (naming, patterns, style)
- Maintain strict task scope — nothing extra

### 6. TEST
- Write tests for the implemented functionality
- Cover happy path + relevant edge cases from the spec
- Run the tests and verify they pass
- Run the tests capped to a low worker count (default 2) — see [Capping test parallelism](#capping-test-parallelism). Never run the suite uncapped.

### 7. VERIFY
- Run full build
- Run lint if it exists
- Verify that existing tests are not broken
- Verify TypeScript/types if applicable
- If a tool (lint, TypeScript) does not exist in the project, report as `not_applicable`

### 8. UPDATE TASKS.JSON AND REPORT
- Update the task state in `tasks.json` with the result
- Document execution evidence

---

## Capping test parallelism

ALWAYS cap test parallelism, or vitest/jest spawn one ~2GB worker per CPU core and exhaust RAM on big suites (crashes the machine). Detect the runner and pass its max-workers flag, default **2** (after `-- ` if run via a script, e.g. `npm test -- --maxWorkers=2`):

vitest / jest → `--maxWorkers=2` · playwright → `--workers=2` · pytest-xdist → `-n 2` · go test → `-p 2` · mocha → `--parallel --jobs 2` · bun test / single-process → none.

Prefer scoped tests (only what the change touches); leave the full suite to CI. Unknown runner or no worker concept → run normally, don't invent flags.

---

## Updating tasks.json

Each task's `status` transitions pending → in_progress (saved before implementing, step 3) → completed. Do NOT skip in_progress.

After completing a task, update its entry in tasks.json with the following additional fields:

```json
{
  "id": "T02",
  "status": "completed",
  "completed_at": "2026-03-01T15:30:00Z",
  "completion_summary": "Implemented installment calculation logic with rounding handling",
  "files_modified": [
    "src/checkout/payment.ts",
    "tests/checkout/payment.test.ts"
  ],
  "evidence": {
    "build": "pass",
    "tests": "pass (12/12)",
    "lint": "pass"
  }
}
```

Also update the `completed_tasks` field at the root of the JSON.

---

## Evidence Report

When finished, show a summary in this format:

```
STATUS: success | partial | failure
TASK: T02 — [task title]
SUMMARY: "Complete implementation. [N] tests passing. Build OK."
FILES_CHANGED: [list of created/modified files]
EVIDENCE:
  build: pass | fail
  tests: pass (N/N) | fail (N passed, M failed) | not_applicable
  lint: pass | fail (N warnings) | not_applicable
BLOCKERS: [if anything prevents continuing]
NEXT: "T03 can start (T02 dependency resolved)" | "Build fails, review errors above"
```

---

## Rules

1. **Follow the plan**: The plan says what to do and how. You implement, you do not redesign. If the plan has an error or lacks information, report it with `status: failure` and describe the blocker.

2. **Strict scope**: Only implement what the task asks for. Do not add unsolicited "improvements". Do not refactor adjacent code. Do not add extra features.

3. **Tests are mandatory**: Every task that adds business logic must include tests. The test must be verifiable against the acceptance criteria of the spec.

4. **Execution evidence**: Always run build + tests + lint before reporting success. If something fails, report as failure with the exact error. If a tool does not exist, report `not_applicable`.

5. **Project conventions**: Follow existing patterns. If the project uses camelCase, use camelCase. If it uses a specific pattern, follow it. Never introduce a new style unless the plan indicates it.

6. **Do not assume context**: You only know what is written in the artifacts (`.infracode/sessions/{id}/`). If information needed to complete the task is missing, report as a blocker.

7. **Dependencies before executing**: If the task has `depends_on`, verify that those tasks are in status `completed` before starting. If they are not, report the blocker.

---

## End of Execution

When you finish your work, you **MUST** return control to the orchestrator.
