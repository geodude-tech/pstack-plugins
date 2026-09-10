# pstack-to-codex

`pstack-to-codex` converts a local checkout of Cursor's `pstack` plugin into a reviewable local marketplace for another host. It supports two targets, `codex` (default) and `claude`. It does not fetch source code, install the generated plugin, execute copied scripts, or claim automatic semantic parity.

## Requirements

- Node.js 20 or newer
- A local checkout containing `pstack/.cursor-plugin/plugin.json`, or the `pstack/` directory itself
- Git is optional; when available, the source commit is recorded in the conversion receipt

## Repository layout

This repository holds both the converter (`bin/`, `src/`, `test/`) and its committed output for both targets, side by side:

```text
pstack-plugins/
├── bin/, src/, test/           ← the converter itself
└── generated/                  ← committed output for both targets, one marketplace root
    ├── .agents/plugins/marketplace.json    (Codex)
    ├── .claude-plugin/marketplace.json     (Claude Code)
    ├── .pstack-to-codex.json               (Codex conversion receipt)
    ├── .pstack-to-codex.claude.json        (Claude Code conversion receipt)
    └── plugins/
        ├── pstack-for-codex/
        └── pstack-for-claude/
```

The two plugin directories are never merged into one shared `skills/` tree: the converter rewrites each skill's invocation text to match its target's own convention (`$name` for Codex, plain `name` for Claude Code — see [Compatibility behavior](#compatibility-behavior) below), so the same skill's file content is not identical across targets.

## Refresh after an upstream update

Keep a durable clone of the upstream Cursor `pstack` source elsewhere (not under this repo), `git pull` it, then run:

```bash
scripts/regenerate.sh /path/to/upstream/checkout/pstack
```

This regenerates both targets into their own temporary directories and copies each one into `generated/` at only the paths it owns (`plugins/<name>/` and that target's own manifest/marketplace file) — refreshing one target never touches the other's files. Review what changed with `git status generated/` and `git diff generated/`, paying particular attention to `compatibility/report.md` in each plugin, before committing.

Do not use the CLI's own `--force` flag to refresh `generated/` directly: `--force` replaces its entire `--out` destination, which would delete the sibling target's output if both targets share one destination.

## Convert

From this repository:

```bash
node ./bin/pstack-to-codex.js /path/to/cursor/plugins \
  --out /path/to/generated-pstack-marketplace
```

The plugin root can be passed directly instead:

```bash
node ./bin/pstack-to-codex.js /path/to/cursor/plugins/pstack \
  --out /path/to/generated-pstack-marketplace
```

Generate a Claude Code plugin instead of a Codex plugin with `--target claude`:

```bash
node ./bin/pstack-to-codex.js /path/to/cursor/plugins/pstack \
  --out /path/to/generated-pstack-marketplace \
  --target claude
```

Preview the result without creating the destination:

```bash
node ./bin/pstack-to-codex.js /path/to/cursor/plugins \
  --out /path/to/generated-pstack-marketplace \
  --dry-run --json
```

Use `--name team-pstack` to change the generated plugin name. Use `--force` to replace an earlier output from this converter. Replacement is staged first and refuses destinations without a valid `.pstack-to-codex.json` ownership receipt.

## Exit codes

- `0`: conversion succeeded with no manual-review findings
- `1`: invalid input or conversion failure
- `2`: conversion succeeded, but the compatibility report contains manual-review findings

Exit `2` is expected for an unmodified upstream pstack checkout because Cursor-only agents and automations are omitted deliberately.

## Generated layout

The Codex target (default) writes:

```text
generated-pstack-marketplace/
├── .agents/plugins/marketplace.json
├── .pstack-to-codex.json
└── plugins/pstack-for-codex/
    ├── .codex-plugin/plugin.json
    ├── compatibility/report.json
    ├── compatibility/report.md
    ├── NOTICE.generated.md
    ├── skills/
    ├── docs/
    └── scripts/
```

`--target claude` writes the same shared content under a Claude Code manifest instead:

```text
generated-pstack-marketplace/
├── .claude-plugin/marketplace.json
├── .pstack-to-codex.json
└── plugins/pstack-for-claude/
    ├── .claude-plugin/plugin.json
    ├── compatibility/report.json
    ├── compatibility/report.md
    ├── NOTICE.generated.md
    ├── skills/
    ├── docs/
    └── scripts/
```

The converter copies `skills/`, `docs/`, `scripts/`, `assets/`, `README.md`, `LICENSE`, and `NOTICE` when present. It rejects symlinks and omits Cursor runtime directories such as `agents/`, `automations/`, and `hooks/`.

## Compatibility behavior

Automatic rewriting is intentionally narrow, and differs by target:

- For Codex, backticked invocations such as `` `/poteto-mode` `` become `` `$poteto-mode` `` only when a matching copied skill exists; line-leading invocations receive the same treatment. Codex has no native equivalent for `$name`-style skill references, so this sigil is Codex's own convention (see its `defaultPrompt` manifest field).
- For Claude Code, the same invocations lose only their leading slash (`` `/poteto-mode` `` becomes `` `poteto-mode` ``), since Claude Code has no invocation sigil of its own.
- API paths and unknown slash commands are never rewritten for either target.
- For Codex, the same Cursor model slugs become role aliases: `pstack-judgment` selects `gpt-6-astra` at low reasoning effort; `pstack-fast` selects `gpt-5.6-luna` at high effort; `pstack-balanced` selects `gpt-5.6-sol` at medium effort for Reflect tooling and one seat in each panel. Each affected Markdown file includes the routing table and instructions to pass model and effort separately, validate availability, and read optional overrides from `~/.codex/pstack-models.md`. The aliases are not registered agent types. Repeated panel entries remain separate agents, but these defaults do not preserve cross-provider diversity. Run `$setup-pstack` to change the choices.
- For Claude Code, Cursor model slugs become plugin subagents. Cursor packs model and reasoning effort into one slug (`grok-4.6-fast-xhigh`); Claude Code sets effort only in an agent definition, so the converter emits `agents/pstack-judgment.md` (Fable 5.1, effort low, replacing `claude-fable-5-1-thinking-max`, `claude-opus-5-thinking-xhigh`) and `agents/pstack-fast.md` (Sonnet 5, effort high, replacing `grok-4.6-fast-xhigh`), emits `agents/pstack-balanced.md` (Opus, effort medium, replacing `gpt-5.6-sol-max`) for Reflect tooling and one seat in each panel, rewrites every slug to the agent name, and rewrites `~/.cursor/rules/pstack-models.mdc` to `~/.claude/rules/pstack-models.md`. The mapping lives in `src/models.js`.

The scanner reports Cursor-only paths, commands, tool references, and model identifiers left in the copied text, plus components omitted from executable discovery. What counts as a finding is target-specific: Claude Code already ships `AskUserQuestion`, an `Agent` tool, a `/loop` skill, and `claude-*` model names natively, so the Claude Code report does not flag those; the Codex report does, since Codex has no built-in equivalent. Review `compatibility/report.md` in the generated plugin before installation.

## Install the reviewed result

After reviewing and editing the generated files as needed:

```bash
codex plugin marketplace add /absolute/path/to/generated-pstack-marketplace
codex plugin add pstack-for-codex@pstack-for-codex-local
codex plugin list --json
```

Start a new Codex task after installation so the plugin catalog and skills are reloaded.

For a `--target claude` output, install it into Claude Code instead:

```text
/plugin marketplace add /absolute/path/to/generated-pstack-marketplace
/plugin install pstack-for-claude@pstack-for-claude-local
```

Start a new Claude Code session after installation so the plugin catalog and skills are reloaded.

## Development

```bash
npm test
npm run check
```

The test suite uses synthetic local fixtures and temporary directories. It does not access the network or modify personal Codex configuration.

## Safety model

Treat generated skills and scripts as untrusted code until reviewed. This tool preserves source provenance and identifies known incompatibilities, but a mechanical converter cannot prove that instructions written for another host have equivalent behavior in the target host.
