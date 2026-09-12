# Generated attribution notice

This plugin was converted from pstack version 0.15.2 at commit 889ec4b68fa5aab0e867dad71ec3fdf386ae48f3.

pstack originates in the Cursor plugins repository and is distributed under its declared license. This generated conversion is not an official Cursor or Anthropic project.

Review `compatibility/report.md` before using the generated workflows.

## Model routing

Cursor model slugs were rewritten to plugin subagents in `agents/`, because Claude Code sets reasoning effort only in an agent definition. Where a skill says `model`, pass the name as `subagent_type` instead.

- `pstack-judgment` (fable, effort low) replaces `claude-fable-5-1-thinking-max`, `claude-opus-5-thinking-xhigh`
- `pstack-fast` (sonnet, effort high) replaces `grok-4.6-fast-xhigh`
- `pstack-balanced` (opus, effort medium) replaces `gpt-5.6-sol-max`
