import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { convertPstack } from "../src/conversion.js";
import { validateGeneratedPlugin } from "../src/validation.js";
import { createCursorPstack } from "./helpers.js";

test("validates a complete generated plugin", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-validation-source-"));
  const source = await createCursorPstack(sourceParent);
  const result = await convertPstack({ sourcePath: source, destination: `${sourceParent}-output` });

  const validation = await validateGeneratedPlugin(result.destination, result.pluginName);

  assert.equal(validation.valid, true);
  assert.equal(validation.skillCount, 2);
});

test("validates a complete generated Claude Code plugin", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-validation-source-"));
  const source = await createCursorPstack(sourceParent);
  const result = await convertPstack({ sourcePath: source, destination: `${sourceParent}-output`, target: "claude" });

  const validation = await validateGeneratedPlugin(result.destination, result.pluginName, "claude");

  assert.equal(validation.valid, true);
  assert.equal(validation.skillCount, 2);
});

test("rejects an invalid marketplace source path for a generated Claude Code plugin", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-validation-source-"));
  const source = await createCursorPstack(sourceParent);
  const result = await convertPstack({ sourcePath: source, destination: `${sourceParent}-output`, target: "claude" });
  const marketplacePath = path.join(result.destination, ".claude-plugin", "marketplace.json");
  const marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));
  marketplace.plugins[0].source = "../../outside";
  await writeFile(marketplacePath, JSON.stringify(marketplace));

  await assert.rejects(
    () => validateGeneratedPlugin(result.destination, result.pluginName, "claude"),
    /marketplace source path/,
  );
});

test("rejects invalid manifest versions and marketplace paths", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-validation-source-"));
  const source = await createCursorPstack(sourceParent);
  const result = await convertPstack({ sourcePath: source, destination: `${sourceParent}-output` });
  const manifestPath = path.join(result.pluginRoot, ".codex-plugin", "plugin.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.version = "latest";
  await writeFile(manifestPath, JSON.stringify(manifest));

  await assert.rejects(
    () => validateGeneratedPlugin(result.destination, result.pluginName),
    /strict semantic version/,
  );

  manifest.version = "1.0.0";
  await writeFile(manifestPath, JSON.stringify(manifest));
  const marketplacePath = path.join(result.destination, ".agents", "plugins", "marketplace.json");
  const marketplace = JSON.parse(await readFile(marketplacePath, "utf8"));
  marketplace.plugins[0].source.path = "../../outside";
  await writeFile(marketplacePath, JSON.stringify(marketplace));

  await assert.rejects(
    () => validateGeneratedPlugin(result.destination, result.pluginName),
    /marketplace source path/,
  );
});

test("does not carry unsafe source URLs into the generated manifest", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-validation-source-"));
  const source = await createCursorPstack(sourceParent);
  const cursorManifestPath = path.join(source, ".cursor-plugin", "plugin.json");
  const cursorManifest = JSON.parse(await readFile(cursorManifestPath, "utf8"));
  cursorManifest.homepage = "javascript:alert(1)";
  cursorManifest.repository = "file:///private/source";
  await writeFile(cursorManifestPath, JSON.stringify(cursorManifest));

  const result = await convertPstack({ sourcePath: source, destination: `${sourceParent}-output` });
  const manifest = JSON.parse(
    await readFile(path.join(result.pluginRoot, ".codex-plugin", "plugin.json"), "utf8"),
  );

  assert.equal(manifest.homepage, undefined);
  assert.equal(manifest.repository, undefined);
  assert.equal(manifest.interface.websiteURL, undefined);
});
