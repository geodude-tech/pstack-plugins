---
name: swarm
description: "Fan out N parallel workers, drain them, and return one report. Use for /swarm, 'swarm this', or parallel coverage, races, gauntlets, and exploration."
disable-model-invocation: false
---

# Swarm

Fan out N parallel cloud workers. They may cover separate slices, race the same brief, or mix both. The parent waits, aggregates, and returns one report.

## Start

Open a todolist with one entry per phase before launching anything.

1. Frame
2. Fan out
3. Aggregate
4. Report

## Phase A: Frame

1. State the done predicate and the artifact or report the swarm must return.
2. Choose the shape. Partition into slices, race N workers on identical briefs, or mix both. For a race or mixed shape, declare `first pass`, `rank all`, or `best-of` before spawning.
3. Set N from the user or derive it from the shape. N is total workers, not the cloud concurrency limit.
4. Pick the worker model from `swarm workers` in `~/.codex/pstack-models.md` when present. Otherwise use `pstack-fast`. For a model race, name each arm's model up front.
5. Give each worker its own writable output when it writes.

## Phase B: Fan out

Spawn all N workers in one message with `subagent_type: generalPurpose`, `environment: "cloud"`, `run_in_background: true`, and the configured model. Use `environment: "local"` only when the worker needs access to something on the user's computer.

When a worker must start from a non-default pushed branch, pass `cloud_base_branch`.

Every brief stands alone. Include the goal, scope, exact slice or race arm, how to verify, and what to report. Reports use `PASS`, `ISSUES`, or `BLOCKED` with evidence.

If a worker drops out, proceed with N-1 and note it.

## Phase C: Aggregate

Read the terminal results. For coverage, every required slice needs a result. For a race, apply the selection rule declared up front. Use first pass, rank all, or best-of. Do not paste raw worker dumps.

Keep a compact result table, one-line evidenced issues, and explicit gaps or dropouts.

## Phase D: Report

Return one consolidated in-chat report with the table, issue one-liners, gaps or dropouts, and the race rule when used.

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
