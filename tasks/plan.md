# Implementation Plan: pstack-to-codex

## Overview

Build a dependency-free Node.js CLI in four vertical slices: establish the contract and source discovery, generate a safe Codex plugin, add conservative compatibility analysis, then verify the full command and document installation.

## Architecture Decisions

- Keep the tool offline and dependency-free so it can run against an already-reviewed local clone.
- Separate pure transformation functions from filesystem orchestration for fast unit tests.
- Treat unresolved host-specific language as a successful conversion with manual-review exit code `2`.
- Permit destructive replacement only when a destination contains this tool's ownership receipt.

## Task List

### Phase 1: Contract and discovery

- [ ] Task 1: Define CLI parsing, source discovery, and safe path rules.
- [ ] Task 2: Add fixture builders and failing tests for supported layouts and invalid inputs.

### Checkpoint: Foundation

- [ ] Focused discovery tests pass.

### Phase 2: Conversion

- [ ] Task 3: Generate manifests, copy supported content, and record provenance.
- [ ] Task 4: Add conservative text rewrites and compatibility findings.

### Checkpoint: Core conversion

- [ ] Filesystem integration tests pass and generated JSON validates.

### Phase 3: CLI and delivery

- [ ] Task 5: Implement dry-run, JSON output, exit codes, and safe force behavior.
- [ ] Task 6: Add README usage and run an end-to-end smoke conversion.

### Checkpoint: Complete

- [ ] Full test and syntax-check suites pass.
- [ ] Generated artifact passes the bundled Codex plugin validator.
- [ ] Implementation is reviewed for correctness and scope.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Upstream changes introduce new Cursor primitives | High | Scanner reports unknown host-specific terms and source version/commit |
| `--force` deletes unrelated files | High | Require an ownership receipt matching the destination |
| Mechanical rewrites change semantics | High | Small allowlist of exact substitutions; report everything else |
| Symlink escapes copy files outside source | High | Reject every symlink during traversal |

## Open Questions

- None blocking for the conservative first release.
