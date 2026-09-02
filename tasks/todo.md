# pstack-to-codex Tasks

## Task 1: Source discovery and safety contract

**Acceptance criteria:**
- [x] Repository-root and plugin-root inputs resolve to the same source.
- [x] Invalid manifests and nested output paths fail safely.

**Verification:** `node --test test/discovery.test.js`

**Dependencies:** None

## Task 2: Manifest and content conversion

**Acceptance criteria:**
- [x] Generated Codex manifest and marketplace entry use valid paths and identifiers.
- [x] Supported source content is copied without mutating the source.
- [x] Provenance receipt records source version and Git commit when available.

**Verification:** `node --test test/conversion.test.js`

**Dependencies:** Task 1

## Task 3: Compatibility rewriting and reporting

**Acceptance criteria:**
- [x] Known safe substitutions are deterministic.
- [x] Unsupported Cursor commands, paths, models, hooks, agents, and automations are reported.
- [x] Markdown and JSON reports agree on finding counts.

**Verification:** `node --test test/compatibility.test.js`

**Dependencies:** Task 2

## Task 4: CLI lifecycle and end-to-end behavior

**Acceptance criteria:**
- [x] Human, JSON, and dry-run modes honor the documented exit codes.
- [x] `--force` replaces only tool-owned output and preserves it if regeneration fails.
- [x] README documents conversion, review, validation, and installation.

**Verification:** `npm test && npm run check`

**Dependencies:** Tasks 1–3

## Task 5: Claude Code as a second conversion target

**Acceptance criteria:**
- [x] `--target claude` (and `convertPstack({ target: "claude" })`) generates `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` instead of the Codex shapes; `--target` defaults to `codex` and rejects unknown values.
- [x] Compatibility findings and skill-invocation rewrites are target-aware: Claude Code's own `AskUserQuestion`, `Agent` tool, `/loop` skill, and `claude-*` model names are not reported as findings for that target, and its rewritten skill invocations carry no sigil.
- [x] `validateGeneratedPlugin` validates the Claude Code shape as strictly as the Codex shape.

**Verification:** `npm test`

**Dependencies:** Tasks 1-4

## Final checkpoint

- [x] All tests pass.
- [x] Smoke-generated plugin passes Codex plugin validation.
- [x] Smoke-generated Claude Code plugin passes Claude Code plugin validation.
- [x] Code review completed.
