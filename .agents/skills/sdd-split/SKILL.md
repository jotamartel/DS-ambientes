---
user-invocable: false
name: sdd-split
description: Instructions for the orchestrator to split a large task into multiple SDD sessions linked via parent_id. Covers how to structure each session's requirements, document contracts between sibling sessions, create additional Jira tickets when scope exceeds the original ticket, and manage multiple active sessions.
---

# Skill: SDD Split

When the orchestrator has already decided to split a task (see the "Session Splits" section of the orchestrator for when and how to present it to the user), this skill describes **how** to materialize the split: create sessions, link them, build their `--requirement`, document contracts, and manage them throughout their lifecycle.

The **when to split**, **how to present the split to the user**, and **when NOT to split** lives in the orchestrator. Here lives the **how to execute it**.

---

## Hierarchical session structure

A split produces a session tree:

```
parent session (feat-platform-xxxxxxxx)
├── child session 1 (feat-backend-yyyyyyyy) --parent-id <parent>
├── child session 2 (feat-frontend-zzzzzzzz) --parent-id <parent>
└── child session 3 (feat-infra-wwwwwwww) --parent-id <parent>
```

- **Parent session**: groups the split. It may have its own high-level spec (end-to-end vision), but its real work is done by the children. It does not always have a `code` phase; many times it remains as a logical container.
- **Child sessions**: each one is a standard SDD session with its own full flow (spec → plan → code → validate). They have a `parent_id` pointing to the parent.

If one of the sessions in the split already existed before the need to split was detected (because the orchestrator started and then the scope was revealed to be large), **reuse it** as parent or child as appropriate — do not create a duplicate. To convert an existing session into the group parent, use it as the parent in the `--parent-id` of the new children.

---

## Creating split sessions

### 1. Parent session

```bash
infracode session create --feature "{split title}" [--jira-ticket TICKET] --requirement "{end-to-end vision + axis index}" --output json
```

The `--requirement` for the parent must include:

- End-to-end vision of the large feature (one paragraph).
- Enumeration of the work axes with a short title for each one.
- Dependencies between axes (which blocks which).
- Global success criteria for the complete feature (not for each axis separately).

### 2. Child sessions

One per identified axis:

```bash
infracode session create --feature "{axis X}" --parent-id {parent-id} [--jira-ticket TICKET] --requirement "{focus + contract}" --output json
```

The `--requirement` for each child must have three explicit parts:

1. **Exclusive focus**: what this session resolves and **only** this session. One paragraph.
2. **Contract with siblings**: what this session produces that others will consume (APIs, types, schemas, routes, endpoints, module contracts, etc.), and what it consumes from others (and from which sibling it expects it). List explicitly.
3. **Out of scope**: what is deliberately excluded and is done by another sibling or left for a future session.

**Example `--requirement` for a child:**

```
FOCUS: Implement the POST /carts endpoint and persistence in Postgres.
Includes payload validation, serialization, and error handling in the carts module.

CONTRACT:
- Produces: JSON schema of the response (documented in this session's spec.md) + type
  CartResponse in src/carts/types.ts.
- Consumes: nothing (first axis of the split).

OUT OF SCOPE:
- Cart UI (axis "frontend-mini-cart", sibling session).
- Sync with the orders backend (axis "orders-integration", sibling session,
  depends on this one).
```

---

## Jira: same ticket vs. additional ticket

### Case 1: the entire split falls under the same Jira ticket

When the original ticket covers the full scope (even if large), link **all** sessions (parent and children) to the same `--jira-ticket`. Push/pull continues to work with the same ticket; each session pushes its own artifacts.

### Case 2: an axis exceeds the scope of the original ticket

When an axis of the split represents work that clearly was not in the original ticket (e.g.: the ticket asks for "mini cart" but the split reveals that the user session system needs to be redesigned so the cart persists), **create a new Jira ticket** for that axis:

```bash
infracode jira issue create --summary "..." --description "..." --output json
```

In the new ticket's `description`, document the relationship with the original ticket textually:

```
Ticket derived from PROJ-123 (SDD split).
This ticket covers the "user session redesign" axis of the parent feature.
Related: PROJ-123.
```

There is no subcommand yet to create formal links between tickets; the text in the description is the current mechanism. Inform the user that the formal link remains pending to be created manually in Jira if needed.

Then create the child session for that axis with `--jira-ticket <new-ticket>`, not with the original.

---

## Dependencies and execution order

When you present the split to the user (that is done by the orchestrator), diagram dependencies. When creating sessions:

- **Independent axes** (can run in parallel): no order needed, they can all start in spec.
- **Sequential axes** (B depends on A): create both, but leave B in its initial state without starting the flow. Start it when A closes its contract (whichever phase that corresponds to — spec, code, etc.).

Document the dependencies in the `--requirement` of the parent and in the "Consumes" field of the `--requirement` of each child. The orchestrator uses them to decide when to unblock each session.

---

## Managing the split in progress

### List the full tree

```bash
infracode session list --output json
```

Filter by `parent_id == {parent}` to see the children. The global state of the split is the aggregation of the states of all sessions in the tree.

### Resume a session in the split

When the user resumes a session that is a child of a split:

1. List the parent + all siblings with their current state.
2. Present the tree context to the user: "This session is part of split X. Current state: A=done, B=code in progress, C=spec approved. You are in B."
3. Start from the corresponding phase in the active session.

### Close a session and unblock others

When a child closes (`status=done`):

1. Check whether any sibling had it as a dependency (see "Consumes" in the `--requirement`).
2. If yes, offer the user to start that sibling: "Session B just closed. Session C depended on B's contract. Shall we start C?"
3. If all children have closed, offer to close the parent or run an end-to-end validation on the complete feature.

### Validate contracts between siblings

When a child publishes an artifact that another consumes (e.g.: B publishes a JSON schema and C consumes it):

1. Before the phase approval gate of B, verify that B produced what its contract with C promised.
2. If you detect a divergence (B promised a field `orderId` but generated `order_id`), **escalate to the user before approving** B's phase: "B generated X but its contract with C promised Y. Do we adjust B or C?"
3. Never advance silently when there is divergence — it is the main source of bugs in splits.

---

## Progress report to the user

When presenting progress during a split, show the state of the full tree, not just the active session. Recommended format:

```
Split "Mini cart with persistence" (parent: feat-minicart-a1b2c3d4)
├── backend-carts (feat-carts-e5f6g7h8)   → code in_progress (3/5 tasks)
├── frontend-mini-cart (feat-fe-i9j0k1l2) → spec approved, waiting for backend contract
└── sync-orders (feat-sync-m3n4o5p6)      → pending, depends on backend-carts

Currently active: backend-carts, code phase.
```

---

## Checklist before closing the split

- [ ] All children closed with status `done` and QA PASS.
- [ ] The contracts published by each child were correctly consumed by their consumers (no silent divergence).
- [ ] The parent received a consolidated summary (if it has its own artifacts, update them; if not, leave a record in session.json via `infracode session complete`).
- [ ] If there are Jira ticket(s), push the final artifacts to each one.
- [ ] If a derived Jira ticket was created, inform the user that the formal link between the original ticket and the derived one remains pending to be created manually.

---

## If the user rejects the split

Continue with the original single session without splitting. Document the decision in the `--requirement` or in `spec.md` (one line: "Split into N axes evaluated, rejected by the user: <brief reason>") so future sessions do not repeat the evaluation.
