import assert from "node:assert/strict";
import { lstat, mkdtemp, readFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { convertPstack } from "../src/conversion.js";
import { createCursorPstack } from "./helpers.js";

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

test("generates a Codex marketplace with a translated plugin manifest", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-convert-source-"));
  const source = await createCursorPstack(sourceParent);
  const destination = `${sourceParent}-output`;

  const result = await convertPstack({ sourcePath: source, destination });

  const pluginRoot = path.join(destination, "plugins", "pstack-for-codex");
  const manifest = await readJson(path.join(pluginRoot, ".codex-plugin", "plugin.json"));
  assert.equal(result.pluginRoot, pluginRoot);
  assert.equal(manifest.name, "pstack-for-codex");
  assert.equal(manifest.version, "0.14.6");
  assert.equal(manifest.skills, "./skills/");
  assert.equal(manifest.author.name, "Lauren Tan");
  assert.equal(manifest.interface.developerName, "Lauren Tan");
  assert.equal(manifest.agents, undefined);

  const marketplace = await readJson(path.join(destination, ".agents", "plugins", "marketplace.json"));
  assert.equal(marketplace.name, "pstack-for-codex-local");
  assert.deepEqual(marketplace.plugins[0].source, {
    source: "local",
    path: "./plugins/pstack-for-codex",
  });
  assert.equal(marketplace.plugins[0].policy.installation, "AVAILABLE");
});

test("copies supported content, omits Cursor runtime directories, and records provenance", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-convert-source-"));
  const source = await createCursorPstack(sourceParent);
  const originalSkill = await readFile(path.join(source, "skills", "poteto-mode", "SKILL.md"), "utf8");
  const destination = `${sourceParent}-output`;

  await convertPstack({ sourcePath: source, destination });

  const pluginRoot = path.join(destination, "plugins", "pstack-for-codex");
  assert.equal((await lstat(path.join(pluginRoot, "skills"))).isDirectory(), true);
  assert.equal((await lstat(path.join(pluginRoot, "docs"))).isDirectory(), true);
  assert.equal((await lstat(path.join(pluginRoot, "scripts"))).isDirectory(), true);
  await assert.rejects(() => lstat(path.join(pluginRoot, "agents")), /ENOENT/);
  await assert.rejects(() => lstat(path.join(pluginRoot, "automations")), /ENOENT/);

  const receipt = await readJson(path.join(destination, ".pstack-to-codex.json"));
  assert.equal(receipt.generator, "pstack-to-codex");
  assert.equal(receipt.plugin.name, "pstack-for-codex");
  assert.equal(receipt.source.version, "0.14.6");
  assert.equal(receipt.source.commit, null);
  assert.ok(receipt.copiedFiles.includes("skills/poteto-mode/SKILL.md"));
  assert.deepEqual(receipt.omittedPaths.sort(), ["agents", "automations"]);

  assert.equal(
    await readFile(path.join(source, "skills", "poteto-mode", "SKILL.md"), "utf8"),
    originalSkill,
  );
});

test("rejects symlinks anywhere in copied content", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-convert-source-"));
  const source = await createCursorPstack(sourceParent);
  await symlink("../../../LICENSE", path.join(source, "skills", "poteto-mode", "linked-license"));

  await assert.rejects(
    () => convertPstack({ sourcePath: source, destination: `${sourceParent}-output` }),
    /Symlinks are not allowed/,
  );
});

test("supports a custom normalized plugin name", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-convert-source-"));
  const source = await createCursorPstack(sourceParent);
  const destination = `${sourceParent}-output`;

  const result = await convertPstack({ sourcePath: source, destination, name: "Our PStack" });

  assert.equal(result.pluginName, "our-pstack");
  assert.equal(result.pluginRoot, path.join(destination, "plugins", "our-pstack"));
});
