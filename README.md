# pstack-to-codex

`pstack-to-codex` converts a local checkout of Cursor's `pstack` plugin into a reviewable local Codex marketplace. It does not fetch source code, install the generated plugin, execute copied scripts, or claim automatic semantic parity.

## Requirements

- Node.js 20 or newer
- A local checkout containing `pstack/.cursor-plugin/plugin.json`, or the `pstack/` directory itself
- Git is optional; when available, the source commit is recorded in the conversion receipt

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

- Backticked invocations such as `` `/poteto-mode` `` become `` `$poteto-mode` `` only when a matching copied skill exists.
- Line-leading skill invocations receive the same treatment.
- API paths and unknown slash commands are not rewritten.

The scanner reports Cursor paths, Cursor commands, agent/tool references, host-specific model identifiers, and omitted runtime components. Review `compatibility/report.md` in the generated plugin before installation.

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

Treat generated skills and scripts as untrusted code until reviewed. This tool preserves source provenance and identifies known incompatibilities, but a mechanical converter cannot prove that instructions written for another host have equivalent behavior in Codex.
