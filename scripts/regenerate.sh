#!/usr/bin/env bash
# Refresh both plugin targets in ./generated from an upstream pstack checkout,
# after a `git pull` there. Each target is regenerated into its own temporary
# directory and then copied into ./generated at only the paths it owns, so
# refreshing one target never disturbs the other's already-committed output.
set -euo pipefail

SOURCE="${1:?Usage: scripts/regenerate.sh <path-to-upstream-pstack-checkout>}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$ROOT/generated"

for TARGET in codex claude; do
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT

  RESULT_JSON="$TMP/result.json"
  node "$ROOT/bin/pstack-to-codex.js" "$SOURCE" --out "$TMP/out" --target "$TARGET" --json > "$RESULT_JSON" || true
  PLUGIN_NAME="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$RESULT_JSON','utf8')).pluginName)")"

  mkdir -p "$DEST/plugins"
  rm -rf "${DEST:?}/plugins/$PLUGIN_NAME"
  cp -r "$TMP/out/plugins/$PLUGIN_NAME" "$DEST/plugins/$PLUGIN_NAME"

  if [ "$TARGET" = "codex" ]; then
    mkdir -p "$DEST/.agents/plugins"
    cp "$TMP/out/.agents/plugins/marketplace.json" "$DEST/.agents/plugins/marketplace.json"
    cp "$TMP/out/.pstack-to-codex.json" "$DEST/.pstack-to-codex.json"
  else
    mkdir -p "$DEST/.claude-plugin"
    cp "$TMP/out/.claude-plugin/marketplace.json" "$DEST/.claude-plugin/marketplace.json"
    cp "$TMP/out/.pstack-to-codex.json" "$DEST/.pstack-to-codex.$TARGET.json"
  fi

  rm -rf "$TMP"
  trap - EXIT
  echo "Refreshed $TARGET -> $DEST/plugins/$PLUGIN_NAME"
done

node "$ROOT/scripts/sync-marketplaces.js"

echo
echo "Review what changed with: git -C \"$ROOT\" status generated/ && git -C \"$ROOT\" diff generated/"
