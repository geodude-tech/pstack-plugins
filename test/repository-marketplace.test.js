import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
for (const [marketplacePath, pluginManifest] of [
  [".agents/plugins/marketplace.json", ".codex-plugin/plugin.json"],
  [".claude-plugin/marketplace.json", ".claude-plugin/plugin.json"],
]) {
  test(`repository root marketplace resolves its plugins: ${marketplacePath}`, async () => {
    const marketplace = JSON.parse(await readFile(new URL(marketplacePath, root), "utf8"));
    const generated = JSON.parse(await readFile(new URL(`generated/${marketplacePath}`, root), "utf8"));
    assert.equal(marketplace.name, generated.name);
    assert.equal(marketplace.plugins.length, generated.plugins.length);
    for (const [index, plugin] of marketplace.plugins.entries()) {
      const source = typeof plugin.source === "string" ? plugin.source : plugin.source.path;
      const original = generated.plugins[index];
      const originalPath = typeof original.source === "string" ? original.source : original.source.path;
      assert.equal(source, `./generated/${originalPath.replace(/^\.\//, "")}`);
      const manifest = JSON.parse(await readFile(new URL(`${source}/${pluginManifest}`, root), "utf8"));
      assert.equal(manifest.name, plugin.name);
    }
  });
}
