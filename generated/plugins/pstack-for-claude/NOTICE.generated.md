# Generated attribution notice

This plugin was converted from pstack version 0.15.5 at commit ecc249f1e306fc64ddf83c7bed16cacf7c2239db.

pstack originates in the Cursor plugins repository and is distributed under its declared license. This generated conversion is not an official Cursor or Anthropic project.

Review `compatibility/report.md` before using the generated workflows.

## Model routing

Cursor model slugs were rewritten to plugin subagents in `agents/`, because Claude Code sets reasoning effort only in an agent definition. Where a skill says `model`, pass the name as `subagent_type` instead.

- `pstack-judgment` (fable, effort low) replaces `claude-fable-5-1-thinking-max`, `claude-opus-5-thinking-xhigh`
- `pstack-fast` (sonnet, effort high) replaces `grok-4.6-fast-xhigh`
- `pstack-balanced` (opus, effort medium) replaces `gpt-5.6-sol-max`
