---
name: setup-pstack
description: Configure which pstack subagent fills each panel seat and how many seats each panel has. Writes an always-applied rule that overrides the skill defaults. Use for /setup-pstack, "configure pstack models", "pstack budget", or changing pstack's model choices.
---

# Setup pstack

Write `~/.claude/rules/pstack-models.md`, an always-applied rule that sets which pstack subagent fills each panel seat and how many seats each panel has.

## What the rule can and cannot change

Model and reasoning effort are fixed per subagent in this plugin's `agents/<name>.md` files. The rule picks among these subagents; it cannot change their model or effort.

| Subagent | Effort | Role |
| --- | --- | --- |
| `pstack-judgment` | low | prose, review, synthesis, panel seats, and the hardest code changes |
| `pstack-fast` | medium | scoped implementation delegates, explorers, and swarm workers |
| `pstack-balanced` | medium | reflect tooling and one seat in each panel |

Only the roles below read the rule. Every other pstack skill names its subagent directly, so a rule line for another role has no effect. The list length sets the seat count: one subagent runs per entry, alias entries included. Panel seats are the main cost lever; fewer seats cost less than any single model change.

## Steps

1. Read `~/.claude/rules/pstack-models.md` if it exists and treat its role values as the current choices. Otherwise start from the defaults below.
2. Show every role with its value. Ask whether to accept as-is or change specific roles. Prefer AskUserQuestion over free text. Offer the three subagents plus `inherit-parent` and `auto`, which both mean the seat runs on the parent chat model (omit `subagent_type`). For `arena cross-judge pool` Arena selects one entry whose model differs from the parent's when possible. `swarm workers` is the default for every worker unless a race or comparison assigns another per arm.
3. Validate: every entry must be one of the subagent names above, `inherit-parent`, or `auto`. If not, ask again.
4. Write the whole file so re-runs stay idempotent:

```
---
description: pstack per-role model choices (overrides skill defaults)
alwaysApply: true
---
# pstack panel configuration. One line per role. Delete a line to fall back to the skill default.
# Values are this plugin's subagent names. Model and effort live in the plugin's agents/ files.
# `inherit-parent` or `auto` as a value: the seat runs on the parent chat model (omit subagent_type). Alias entries still count toward the fan-out.
arena runners: pstack-judgment, pstack-balanced, pstack-fast, pstack-judgment
arena cross-judge pool: pstack-judgment, pstack-balanced, pstack-fast, pstack-judgment
swarm workers: pstack-fast
interrogate reviewers: pstack-judgment, pstack-balanced, pstack-fast, pstack-judgment
```

5. Tell the user the rule was written and that it applies to new sessions. Re-running this skill updates it.
6. Check whether the project has a way to drive the real app for proof (a `verify-*` skill, or an existing harness). If not, offer once to generate one with /create-verification-skill. On no, move on without pushing.
