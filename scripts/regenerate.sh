#!/usr/bin/env bash
# Refresh the Codex plugin in ./generated from an upstream pstack checkout, after a
# `git pull` there. The plugin is regenerated into a temporary directory and then copied
# into ./generated at only the paths it owns.
set -euo pipefail

SOURCE="${1:?Usage: scripts/regenerate.sh <path-to-upstream-pstack-checkout>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/generated"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

RESULT_JSON="$TMP/result.json"
node "$ROOT/bin/pstack-to-codex.js" "$SOURCE" --out "$TMP/out" --json > "$RESULT_JSON" || true
PLUGIN_NAME="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$RESULT_JSON','utf8')).pluginName)")"

mkdir -p "$DEST/plugins" "$DEST/.agents/plugins"
rm -rf "${DEST:?}/plugins/$PLUGIN_NAME"
cp -r "$TMP/out/plugins/$PLUGIN_NAME" "$DEST/plugins/$PLUGIN_NAME"
cp "$TMP/out/.agents/plugins/marketplace.json" "$DEST/.agents/plugins/marketplace.json"
cp "$TMP/out/.pstack-to-codex.json" "$DEST/.pstack-to-codex.json"
echo "Refreshed codex -> $DEST/plugins/$PLUGIN_NAME"

node "$ROOT/scripts/sync-marketplaces.js"

echo
echo "Review what changed with: git -C \"$ROOT\" status generated/ && git -C \"$ROOT\" diff generated/"
