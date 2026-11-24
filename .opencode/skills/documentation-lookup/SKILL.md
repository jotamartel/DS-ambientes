---
user-invocable: false
name: documentation-lookup
description: "Look up up-to-date documentation and code examples for any library or framework using Context7 MCP. Use whenever external technology docs are needed — APIs, SDKs, frameworks, CLI tools, cloud services — especially when the model's knowledge may be outdated."
---

# Documentation Lookup

Look up up-to-date documentation and code examples for any library using the Context7 MCP tools.

## Workflow

Two-step process: resolve the library name to an ID, then query docs with that ID.

### Step 1: Resolve library

Call the MCP tool `resolve-library-id` with:
- `libraryName`: name of the library (e.g.: "react", "express", "prisma")
- `query`: the specific question or task

Select the most relevant result based on:
- Name match (exact match has priority)
- Source reputation (High > Medium > Low)
- Number of available code snippets
- Benchmark score

### Step 2: Query documentation

Call the MCP tool `query-docs` with:
- `libraryId`: the ID obtained in step 1 (format `/org/project`)
- `query`: specific and detailed question

Be specific in the query. "How to set up authentication with JWT in Express.js" works much better than "auth".

## Rules

- **Always resolve first**: do not invent library IDs. Call `resolve-library-id` first, unless the user provides an explicit ID in the `/org/project` format.
- **Maximum 3 calls per question**: if you cannot find what you need in 3 attempts, use the best available result.
- **Versions**: if the user specifies a version, use the `/org/project/version` format from the resolve result.
