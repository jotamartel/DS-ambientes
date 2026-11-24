---
user-invocable: false
name: find-skills
description: Helps users discover and install agent skills using infracode skills commands when they ask about extending capabilities or finding tools for specific tasks.
---

# Find Skills

This skill helps you discover and install skills from the open agent skills ecosystem.

## When to Use This Skill

Use this skill when the user:

- Asks "how do I do X" where X might be a common task with an existing skill
- Says "find a skill for X" or "is there a skill for X"
- Asks "can you do X" where X is a specialized capability
- Expresses interest in extending agent capabilities
- Wants to search for tools, templates, or workflows
- Mentions they wish they had help with a specific domain (design, testing, deployment, etc.)

> **Proactive suggestion**: When the user asks for help with a recurring or specialized task, consider suggesting `infracode skills find` before proceeding. If a skill exists for that domain, installing it will give the agent better and more consistent guidance for the task.

## What is the InfraCode Skills System?

Skills are modular packages that extend agent capabilities with specialized knowledge, workflows, and tools. In InfraCode projects, skills are always installed at the project level — never globally.

`infracode skills` is the command that manages skills in InfraCode projects. It automatically detects which AI tools are configured in the project (from `.infracode/config.json`) and injects the skill into the correct paths for each tool. No need to specify a `--agent` flag manually.

**Key commands:**

- `infracode skills find [query]` — Search for available skills in the ecosystem
- `infracode skills add <package>` — Install a skill in the project (auto-detects configured tools)
- `infracode skills list` — List skills installed in the project
- `infracode skills remove <name>` — Uninstall a skill

**Browse skills at:** https://skills.sh/

## How to Help Users Find Skills

### Step 1: Understand What They Need

When a user asks for help with something, identify:

1. The domain (e.g., React, testing, design, deployment)
2. The specific task (e.g., writing tests, creating animations, reviewing PRs)
3. Whether this is a common enough task that a skill likely exists

### Step 2: Search for Skills

Run the find command with a relevant query:

```bash
infracode skills find [query]
```

For example:

- User asks "how do I make my React app faster?" → `infracode skills find react performance`
- User asks "can you help me with PR reviews?" → `infracode skills find pr review`
- User asks "I need to create a changelog" → `infracode skills find changelog`

The command will return results like:

```
Install with infracode skills add <owner/repo@skill>

vercel-labs/agent-skills@vercel-react-best-practices
└ https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices
```

### Step 3: Present Options to the User

When you find relevant skills, present them to the user with:

1. The skill name and what it does
2. The install command they can run
3. A link to learn more at skills.sh

Example response:

```
I found a skill that might help! The "vercel-react-best-practices" skill provides
React and Next.js performance optimization guidelines from Vercel Engineering.

To install it:
infracode skills add vercel-labs/agent-skills@vercel-react-best-practices

Learn more: https://skills.sh/vercel-labs/agent-skills/vercel-react-best-practices
```

### Step 4: Offer to Install

If the user wants to proceed, you can install the skill for them:

```bash
infracode skills add <owner/repo@skill> -y
```

The `-y` flag skips confirmation prompts. `infracode skills add` automatically detects which AI tools are configured in the project and injects the skill into the correct paths for each one — no additional flags needed.

## Common Skill Categories

When searching, consider these common categories:

| Category        | Example Queries                          |
| --------------- | ---------------------------------------- |
| Web Development | react, nextjs, typescript, css, tailwind |
| Testing         | testing, jest, playwright, e2e           |
| DevOps          | deploy, docker, kubernetes, ci-cd        |
| Documentation   | docs, readme, changelog, api-docs        |
| Code Quality    | review, lint, refactor, best-practices   |
| Design          | ui, ux, design-system, accessibility     |
| Productivity    | workflow, automation, git                |

## Tips for Effective Searches

1. **Use specific keywords**: "react testing" is better than just "testing"
2. **Try alternative terms**: If "deploy" doesn't work, try "deployment" or "ci-cd"
3. **Check popular sources**: Many skills come from `vercel-labs/agent-skills` or `ComposioHQ/awesome-claude-skills`

## When No Skills Are Found

If no relevant skills exist:

1. Acknowledge that no existing skill was found
2. Offer to help with the task directly using your general capabilities
3. Suggest the user could create their own skill with `infracode skills init`

Example:

```
I searched for skills related to "xyz" but didn't find any matches.
I can still help you with this task directly! Would you like me to proceed?

If this is something you do often, you could create your own skill:
infracode skills init my-xyz-skill
```
