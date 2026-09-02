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
- [ ] Known safe substitutions are deterministic.
- [ ] Unsupported Cursor commands, paths, models, hooks, agents, and automations are reported.
- [ ] Markdown and JSON reports agree on finding counts.

**Verification:** `node --test test/compatibility.test.js`

**Dependencies:** Task 2

## Task 4: CLI lifecycle and end-to-end behavior

**Acceptance criteria:**
- [ ] Human, JSON, and dry-run modes honor the documented exit codes.
- [ ] `--force` replaces only tool-owned output.
- [ ] README documents conversion, review, validation, and installation.

**Verification:** `npm test && npm run check`

**Dependencies:** Tasks 1–3

## Final checkpoint

- [ ] All tests pass.
- [ ] Smoke-generated plugin passes Codex plugin validation.
- [ ] Code review completed.
