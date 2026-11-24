# Infracode CLI — Flag `--output`

When running `infracode` commands via Bash, always use the `--output` flag:

- **`--output json`** when the result will be processed programmatically (parsing IDs, paths, status, etc.). This is the default mode for agents.
- **`--output text`** only when the output is meant to be displayed directly to the user.

The `--output` flag is global and works across all subcommands (`session`, `jira`, `skills`, etc.).

Examples:

```bash
infracode session create --feature "..." --output json
# → {"id": "feat-abc-a1b2c3d4", "path": ".infracode/sessions/feat-abc-a1b2c3d4/"}

infracode session list --output json
# → [{"id": "...", "status": "...", ...}, ...]
```
