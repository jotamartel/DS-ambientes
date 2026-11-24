---
user-invocable: false
name: skills-guide
description: Reference guide for managing AI agent skills in InfraCode projects. Covers all infracode skills subcommands, the skills ecosystem, and when to suggest installing skills vs using base agent capabilities.
---

# InfraCode Skills Guide

Complete reference guide for the skills system in the Infra AI Framework.

## What are Skills

Skills are specialized knowledge fragments that the agent loads on demand for specific tasks. Each skill is a directory containing a `SKILL.md` file with instructions, workflows, or context that the agent uses when the skill is activated.

Unlike the agent's general knowledge, skills are:
- **Project-specific**: installed at the project level, not globally
- **Loaded on demand**: the agent activates them when the context is relevant
- **Updatable**: the team can synchronize the same skills via `skills-lock.json`

## Role in InfraCode's SDD Workflow

In the Spec-Driven Development flow (Spec → Plan → Code → Validate), skills complement the framework's specialized agents. While agents (`infra-spec`, `infra-plan`, `infra-code`, etc.) orchestrate the development process, skills provide domain-specific knowledge that the agent can apply at any stage.

Example: a "react-best-practices" skill can be invoked during the Code phase to ensure generated code meets the standards of the React ecosystem.

## Skill Structure

A skill is a directory containing a `SKILL.md` file:

```
.agents/skills/
└── skill-name/
    └── SKILL.md
```

The `SKILL.md` file may include YAML frontmatter with standard fields:

```markdown
---
name: skill-name
description: Description of what the skill does and when to activate it.
---

# Skill Content

Instructions, workflows, examples and context that the agent uses.
```

## Managing Skills with InfraCode

### `infracode skills find [query]`

Searches for available skills in the skills.sh ecosystem. Accepts an optional search query; without a query, shows an interactive browser.

```bash
# Interactive search
infracode skills find

# Keyword search
infracode skills find react performance

# Domain search
infracode skills find testing jest
```

Returns results with the skill name, description, and the command to install it.

### `infracode skills add <package>`

Installs a skill from the specified repository. Automatically detects which AI tools are configured in the project and injects the skill into the correct paths for each tool.

```bash
# Install a specific skill
infracode skills add vercel-labs/agent-skills@vercel-react-best-practices

# Install from a repository with multiple skills
infracode skills add owner/repo@skill-name
```

The package format is `owner/repo@skill-name`. After installing, the skill is placed in `.agents/skills/<name>/` and the necessary links are created for each configured AI tool. No `--agent` flag needed — tool detection is automatic.

### `infracode skills list`

Lists all skills installed in the current project.

```bash
infracode skills list
```

Shows the name, description, and origin of each installed skill.

### `infracode skills remove <name>`

Uninstalls a skill from the project.

```bash
infracode skills remove vercel-react-best-practices
```

Removes the skill directory and associated links in the configured AI tools.

### `infracode skills check`

Checks for available updates for installed skills.

```bash
infracode skills check
```

### `infracode skills update`

Updates all installed skills to their latest versions.

```bash
infracode skills update
```

### `infracode skills experimental_install`

Restores the team's skills from the `skills-lock.json` file. Useful for synchronizing the same skills across all team members.

```bash
infracode skills experimental_install
```

Reads `skills-lock.json` at the project root and installs all listed skills. Equivalent to `npm install` but for agent skills.

## Team Synchronization

`skills-lock.json` is the lockfile of the skills ecosystem. It records the external skills installed in the project with their exact versions, allowing the entire team to use the same skills.

```json
{
  "skills": [
    {
      "name": "vercel-react-best-practices",
      "source": "vercel-labs/agent-skills@vercel-react-best-practices",
      "version": "abc1234"
    }
  ]
}
```

**Recommended team workflow:**
1. A developer installs skills with `infracode skills add`
2. Commits `skills-lock.json` to the repository
3. The rest of the team runs `infracode skills experimental_install` to sync

## Embedded Skills (infra-*)

Embedded skills are distributed inside the InfraCode CLI binary, identified by the `infra-` prefix. They are installed automatically during `infracode init` and updated with `infracode update`.

**Available embedded skills:**
- `find-skills` — Helps discover and install skills from the ecosystem
- `skills-guide` — This reference guide (the one you're reading)

**Characteristics:**
- Always installed in `.agents/skills/infra-*/`
- Overwritten on each `infracode update` (they are part of the framework)
- Do **not** appear in `skills-lock.json` (managed by the binary, not the lockfile)
- Do not require internet connectivity to install

## Canonical Directory and Installation Structure

All skills (embedded and external) are installed in the canonical directory:

```
.agents/skills/<name>/SKILL.md
```

For tools that require specific paths (such as Claude Code, which looks for skills in `.claude/skills/`), InfraCode automatically creates relative symlinks:

```
.claude/skills/<name>/  →  ../../.agents/skills/<name>/
```

Universal tools (OpenCode, Kilo Code, Gemini CLI) use `.agents/skills/` directly.

## When to Suggest Skills

### Suggest installing a skill when:

- The user needs very domain-specific knowledge (proprietary framework, specialized stack)
- The task requires following detailed ecosystem conventions that exceed general knowledge
- The team will perform this task repeatedly and would benefit from consistent instructions
- The user explicitly asks "is there a skill for this?" or "how do I extend the agent's capabilities?"

### Use base agent capabilities when:

- The task is general and the agent already has sufficient knowledge
- Installing a skill would add unnecessary friction for a one-off task
- No relevant skill exists in the ecosystem
- The task can be resolved directly with available tools

### Practical rule

If the user asks how to do something specific, first try to help with base capabilities. If the task requires specialized knowledge that might exist as a skill, offer to search with `infracode skills find` before proceeding. Do not interrupt the user's workflow to propose skills unless it is genuinely useful.

## Browse Skills

The full skills directory is available at: **https://skills.sh**
