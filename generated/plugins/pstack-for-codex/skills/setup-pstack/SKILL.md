---
name: setup-pstack
description: Configure which models pstack uses per role and at what reasoning budget. Detects your available models and writes a Codex preference file that overrides the skill defaults. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Configure pstack's per-role model and reasoning effort in `~/.codex/pstack-models.md`. This is a pstack preference file, read explicitly by the converted workflows, not an automatically loaded Codex rule.

## Steps

1. Inspect the current subagent tool for available models and supported reasoning efforts. Never assume an API model is available in this Codex session. If detection is unavailable, ask the user for their supported choices.
2. Read `~/.codex/pstack-models.md` if it exists. Preserve current choices as the starting point; otherwise use the defaults below.
3. Show every role and its model and effort. Ask the user to accept the mapping or change specific roles. Offer `inherit-parent` and `auto` as aliases that omit both model and effort overrides. Each panel list entry creates one agent, including repeated entries.
4. Validate every selected model and effort against the session's supported values. If a pair is unavailable, ask for a supported replacement before writing.
5. Write the complete preference file below, using the confirmed values. Keep both the alias definitions and the per-role mapping. For a custom choice, define another alias with its model and reasoning effort, then use that alias on the relevant role lines. This file belongs only to pstack; do not overwrite `AGENTS.md` or `config.toml`.

```text
# pstack model preferences
pstack-judgment: model=gpt-6-astra, reasoning_effort=low
pstack-fast: model=gpt-5.6-luna, reasoning_effort=high
pstack-balanced: model=gpt-5.6-sol, reasoning_effort=medium

feature, refactoring: grok-4.7-xhigh-fast
bug-fix: grok-4.7-xhigh-fast
perf-issue: grok-4.7-xhigh-fast
hillclimb: grok-4.7-xhigh-fast
judgment and prose: claude-opus-5-5-xhigh
hardest tasks: claude-opus-5-5-xhigh
how explorer: grok-4.7-xhigh-fast
how explainer: claude-opus-5-5-xhigh
why investigators: grok-4.7-xhigh-fast
why synthesizer: claude-opus-5-5-xhigh
reflect tooling: grok-4.7-xhigh-fast
reflect judgment, divergent, synthesizer: claude-opus-5-5-xhigh
arena runners: claude-opus-5-5-xhigh, grok-4.7-xhigh-fast
arena cross-judge pool: claude-opus-5-5-xhigh, grok-4.7-xhigh-fast
swarm workers: grok-4.7-xhigh-fast
architect runners: claude-opus-5-5-xhigh, grok-4.7-xhigh-fast
interrogate reviewers: claude-opus-5-5-xhigh, grok-4.7-xhigh-fast
```

6. Report the saved choices. Converted workflows read this file before delegating; re-running setup updates the choices.
