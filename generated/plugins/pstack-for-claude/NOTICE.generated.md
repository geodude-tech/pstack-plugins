# Generated attribution notice

This plugin was converted from pstack version 0.15.21 at commit 56aca546a690ae340eccbe57455d5cb6380024c9.

pstack originates in the Cursor plugins repository and is distributed under its declared license. This generated conversion is not an official Cursor or Anthropic project.

Review `compatibility/report.md` before using the generated workflows.

## Model routing

Cursor model slugs were rewritten to plugin subagents in `agents/`, because Claude Code sets reasoning effort only in an agent definition. Where a skill says `model`, pass the name as `subagent_type` instead.

- `pstack-judgment` (claude-opus-5-5, effort extra) replaces `claude-fable-5-1-thinking-max`, `claude-opus-5-thinking-xhigh`
- `pstack-fast` (claude-sonnet-5-5, effort high) replaces `grok-4.6-fast-xhigh`
- `pstack-balanced` (claude-opus-5-5, effort medium) replaces `gpt-5.6-sol-max`
