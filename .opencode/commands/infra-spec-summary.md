---
user-invocable: false
---

# /infra-spec-summary

Generates a TL;DR summary ("spec in 30 seconds") from a spec.md file. Shows what the spec covers, why it exists, its scope, the success gate, and the main risk — all in ~10 lines.

## Instructions for the Agent

1. **Locate the spec.md to summarize:**
   - If an argument was passed (a file path), use that as the spec.md path.
   - If no argument was passed, find the most recently active SDD session:
     ```bash
     ls -td .infracode/sessions/*/  | head -20
     ```
     Then look for a `spec.md` in those session directories (most recent first). Use the first one found.
   - If no spec.md is found anywhere, inform the user: "No spec.md found. Pass a path explicitly: `/infra-spec-summary path/to/spec.md`"

2. **Read the spec.md file.** Extract only what is explicitly written — do not infer or invent content.

3. **Generate the summary in this exact format** (in the project's configured language):

   ```
   ### 📋 {Spec name} en 30 segundos
   **Qué:** {1 sentence — what is being built or changed}
   **Por qué:** {1 sentence — problem or motivation}
   **Alcance:**
   - ✅ Incluye: {short comma-separated list of what is included}
   - ❌ No incluye: {short comma-separated list of what is excluded}
   **Verificación (gate):** {1 line — key acceptance criterion}
   **Riesgo principal:** {1 line — main risk or open question}
   ```

4. **Field mapping rules** (derive from spec content, never invent):
   - **Spec name**: use the spec title/heading or the feature name from the session
   - **Qué**: from the objective or purpose section
   - **Por qué**: from the motivation, problem statement, or context section
   - **Alcance → Incluye**: from the "in scope" or "included" list
   - **Alcance → No incluye**: from the "out of scope" or "excluded" list
   - **Verificación (gate)**: from acceptance criteria — pick the most representative one
   - **Riesgo principal**: from the risks/risks section or open questions

5. **If a field is not present in the spec**, omit that line or write "no especificado" — never fabricate content.

6. Keep the total output to ~10 lines. The goal is to understand what the spec is about and its scope without reading the full document.
