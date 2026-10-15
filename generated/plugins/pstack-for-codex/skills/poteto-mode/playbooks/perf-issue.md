### Perf issue

**You own the measurement story. Plan, review, verify the numbers.** Tie every fix to a measurement, don't read source instead of measuring.

1. Capture a baseline trace via the matching control skill. Vet the baseline, and each later number, with the **benchmark-checklist** skill.
2. `how` to ground hypotheses. Don't claim a perf ceiling without running it first.
   Try the performance mantras in order, cheapest first:
   1. Don't do it. Stop work whose result nothing uses rather than cheapening it.
   2. Do it, but don't do it again.
   3. Do it less.
   4. Do it later.
   5. Do it when they're not looking.
   6. Do it concurrently.
   7. Do it cheaper.

   When an earlier mantra meets the target, stop.
3. Plan the fix from the trace. If it crosses a function boundary, `architect` first. Delegate implementation to a subagent using your configured perf-issue model (default `pstack-fast`). Pick each subagent's reasoning level and fast or standard speed for the job, per the Subagents section. Review the diff. Capture a post-fix trace.
   Apply the **sequence-verifiable-units** principle skill, verifying each attempt before trying the next.
4. Parse and compare the artifacts (JSON to sqlite, diff). "Inconclusive" or wrong-surface is not a pass. Flag it.
5. Cite the measurement in the PR.
6. Run **Opening a PR**.

For sustained improvement against a metric rather than a one-off fix, use the Hillclimb playbook (`playbooks/hillclimb.md`).

**Reply:** baseline number, post-fix number, delta, artifact path.

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
