# pstack-to-codex

`pstack-to-codex` converts a local checkout of Cursor's `pstack` plugin into a reviewable local Codex marketplace. It does not fetch source code, install the generated plugin, execute copied scripts, or claim automatic semantic parity.

**This repository is Codex-only.** Claude Code users should use the official upstream install instead:

```bash
claude plugin install pstack@cursor-plugins
```

The former `pstack-for-claude` package and the converter's `--target claude` option have been removed.

## Requirements

- Node.js 20 or newer
- A local checkout containing `pstack/.cursor-plugin/plugin.json`, or the `pstack/` directory itself
- Git is optional; when available, the source commit is recorded in the conversion receipt

## Repository layout

This repository holds both the converter (`bin/`, `src/`, `test/`) and its committed Codex output:

```text
pstack-plugins/
├── .agents/plugins/marketplace.json    ← root marketplace, points into generated/
├── bin/, src/, test/                   ← the converter itself
└── generated/                          ← committed output, one marketplace root
    ├── .agents/plugins/marketplace.json
    ├── .pstack-to-codex.json           (conversion receipt: upstream version and commit)
    └── plugins/
        └── pstack-for-codex/
```

## Refresh after an upstream update

Keep a durable clone of the upstream Cursor `pstack` source elsewhere (not under this repo), `git pull` it, then run:

```bash
scripts/regenerate.sh /path/to/upstream/checkout/pstack
```

This regenerates the Codex plugin into a temporary directory, copies it into `generated/` at only the paths it owns (`plugins/pstack-for-codex/`, `.agents/plugins/marketplace.json`, and `.pstack-to-codex.json`), and refreshes the root marketplace manifest. Review what changed with `git status generated/` and `git diff generated/`, paying particular attention to `compatibility/report.md`, before committing.

Do not use the CLI's own `--force` flag to refresh `generated/` directly: `--force` replaces its entire `--out` destination.

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

The converter writes:

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

The converter copies `skills/`, `docs/`, `scripts/`, `assets/`, `README.md`, `LICENSE`, and `NOTICE` when present. It rejects symlinks and omits Cursor runtime directories such as `agents/`, `automations/`, and `hooks/`.

## Compatibility behavior

Automatic rewriting is intentionally narrow:

- Backticked invocations such as `` `/poteto-mode` `` become `` `$poteto-mode` `` only when a matching copied skill exists; line-leading invocations receive the same treatment. Codex has no native equivalent for `$name`-style skill references, so this sigil is Codex's own convention (see its `defaultPrompt` manifest field).
- API paths and unknown slash commands are never rewritten.
- Cursor model slugs become role aliases: `pstack-judgment` (upstream `claude-opus-5-5-xhigh`, `claude-opus-5-5-max`, and older Opus/Fable slugs) selects `gpt-6-astra` at low reasoning effort; `pstack-fast` (upstream `grok-4.7-xhigh-fast`, `grok-4.7-medium-fast`, `grok-4.6-fast-xhigh`) selects `gpt-5.6-luna` at high effort; `pstack-balanced` (upstream `claude-opus-5-5-medium`, `gpt-5.6-sol-max`) selects `gpt-5.6-sol` at medium effort for Reflect tooling and one seat in each panel. Each affected Markdown file includes the routing table and instructions to pass model and effort separately, validate availability, and read optional overrides from `~/.codex/pstack-models.md`; upstream's `~/.cursor/rules/pstack-models.mdc` references are rewritten to that file, and `$setup-pstack` is rewritten to write it. The aliases are not registered agent types. Repeated panel entries remain separate agents, but these defaults do not preserve cross-provider diversity. Run `$setup-pstack` to change the choices. The mapping lives in `src/models.js`.

The scanner reports Cursor-only paths, commands, tool references, and model identifiers left in the copied text, plus components omitted from executable discovery. Cursor's `AskUserQuestion`, `Agent` tool, `/loop`, and Claude/Grok model names are flagged, since Codex has no built-in equivalent. Review `compatibility/report.md` in the generated plugin before installation.

## Install from this repository

The repository root contains a Codex marketplace manifest whose plugin path points into `generated/plugins/`. A `local` source in the Codex manifest means a path inside the fetched repository, not a requirement to clone it yourself.

```bash
codex plugin marketplace add geodude-tech/pstack-plugins
codex plugin add pstack-for-codex@pstack-for-codex-local
```

Start a new task after installation. The `-local` marketplace names are retained for compatibility with existing installations. `scripts/regenerate.sh` also refreshes the root manifest.

## Install the reviewed result

After reviewing and editing the generated files as needed:

```bash
codex plugin marketplace add /absolute/path/to/generated-pstack-marketplace
codex plugin add pstack-for-codex@pstack-for-codex-local
codex plugin list --json
```

Start a new Codex task after installation so the plugin catalog and skills are reloaded.

## Development

```bash
npm test
npm run check
```

The test suite uses synthetic local fixtures and temporary directories. It does not access the network or modify personal Codex configuration.

## Safety model

Treat generated skills and scripts as untrusted code until reviewed. This tool preserves source provenance and identifies known incompatibilities, but a mechanical converter cannot prove that instructions written for another host have equivalent behavior in the target host.
