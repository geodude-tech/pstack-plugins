---
name: how
description: "Use for \"how does X work\", code walkthroughs before changing something, and placement / ownership / layering questions (\"where should this live\", \"which package owns this\", \"is this the right layer\"). Explains subsystem architecture, runtime flow, onboarding mental models. Use why for motivation."
disable-model-invocation: false
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations at the level of a senior engineer onboarding onto a subsystem, enough to build a working mental model, not so much that it reads like annotated source code.

Every spawn is a Task subagent with `subagent_type: generalPurpose` and `readonly: true`. Explorers use the `how explorer` line in the `pstack-models.mdc` rule (default `pstack-fast`), and every explainer uses the `how explainer` line (default `pstack-judgment`). Set `model` to that line's value, or to the default if the rule or the line is missing. Leave `model` unset when the value is `auto` or `inherit-parent`. If the Task tool rejects a slug, use the default and say so. If it rejects the default, use the closest valid slug of the same family from its error message. Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section of the **poteto-mode** skill.

## 1. Assess complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): no explorers. Spawn one explainer that explores and explains in one pass, built from `references/explainer-prompt.md` without the explorer-findings section. Go to step 4.
- **Complex** (a subsystem spanning multiple files or services, a cross-cutting feature, a full architectural overview): go to step 2.

When in doubt, take the simple path.

## 2. Explore (complex only)

Decompose the question into 2 to 4 angles, each a distinct slice of the subsystem. Spawn all explorers in a single message, each with `references/explorer-prompt.md` and its angle filled in.

## 3. Synthesize (complex only)

Once all explorers have returned, spawn one explainer with `references/explainer-prompt.md` and every explorer's findings filled in.

## 4. Present

Present the explainer's output. Light edits for clarity or context from the conversation are fine. Do not substantially rewrite it.

## Output format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.

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
