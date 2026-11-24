# Language directive

Read the `language` field from `.infracode/config.json` to determine the user's configured language.

Always respond to the user in that language. This applies to all messages directed to the user. Agent instructions are written in English for LLM processing efficiency; your communication with the human must be in their configured language.

If `.infracode/config.json` does not exist or the `language` field is absent, default to Spanish.
