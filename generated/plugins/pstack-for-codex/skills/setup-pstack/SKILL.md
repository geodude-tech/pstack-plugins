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
judgment and prose: claude-opus-5-5-max
hardest tasks: claude-opus-5-5-max
how explorer: grok-4.7-xhigh-fast
how explainer: claude-opus-5-5-max
why investigators: grok-4.7-xhigh-fast
why synthesizer: claude-opus-5-5-max
reflect tooling: pstack-balanced
reflect judgment, divergent, synthesizer: claude-opus-5-5-max
arena runners: claude-opus-5-5-max, pstack-balanced, grok-4.7-xhigh-fast
arena cross-judge pool: claude-opus-5-5-max, pstack-balanced, grok-4.7-xhigh-fast
swarm workers: grok-4.7-xhigh-fast
architect runners: claude-opus-5-5-max, pstack-balanced, grok-4.7-xhigh-fast
interrogate reviewers: claude-opus-5-5-max, pstack-balanced, grok-4.7-xhigh-fast
```

6. Report the saved choices. Converted workflows read this file before delegating; re-running setup updates the choices.

## Codex model routing

Before delegating, read `~/.codex/pstack-models.md` if it exists. Its per-role choices override these defaults.

| Role alias | Model | Reasoning effort |
| --- | --- | --- |
| pstack-judgment | gpt-6-astra | low |
| pstack-fast | gpt-5.6-luna | high |
| pstack-balanced | gpt-5.6-sol | medium |

These aliases are routing labels, not model IDs or registered agent types. Resolve an alias before spawning and pass the model and reasoning effort separately using the available subagent tool. With `collaboration.spawn_agent`, use `model` and `reasoning_effort`; explicit overrides require `fork_turns` to be `none` or a positive turn count, with sufficient task context in the prompt.

Check the session's available models and effort levels before spawning. If a configured pair is unavailable, ask for a supported replacement. For `inherit-parent` or `auto`, omit both overrides. If the host cannot select a model or effort, report that limitation rather than claim the requested routing was applied.

Keep every panel entry, including repeated aliases, as a separate agent. These defaults do not provide cross-provider diversity; do not claim that repeated roles are different model families.
