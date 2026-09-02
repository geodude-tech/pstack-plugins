import assert from "node:assert/strict";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { assertSafeDestination, discoverSource } from "../src/discovery.js";
import { createCursorPstack } from "./helpers.js";

test("discovers pstack from the Cursor repository root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pstack-discovery-"));
  const expected = await createCursorPstack(root, { asRepository: true });

  const source = await discoverSource(root);

  assert.equal(source.root, expected);
  assert.equal(source.manifest.name, "pstack");
  assert.equal(source.manifest.version, "0.14.6");
});

test("discovers pstack when given the plugin root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pstack-discovery-"));
  await createCursorPstack(root);

  const source = await discoverSource(root);

  assert.equal(source.root, root);
});

test("rejects a source without a Cursor plugin manifest", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pstack-discovery-"));

  await assert.rejects(() => discoverSource(root), /Cursor pstack plugin/);
});

test("rejects malformed and non-pstack manifests", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pstack-discovery-"));
  await mkdir(path.join(root, ".cursor-plugin"));
  await writeFile(path.join(root, ".cursor-plugin", "plugin.json"), "not json");
  await assert.rejects(() => discoverSource(root), /Invalid JSON/);

  await writeFile(
    path.join(root, ".cursor-plugin", "plugin.json"),
    JSON.stringify({ name: "another-plugin", version: "1.0.0", skills: "./skills/" }),
  );
  await assert.rejects(() => discoverSource(root), /Expected plugin name.*pstack/);
});

test("requires a real skills directory", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pstack-discovery-"));
  await mkdir(path.join(root, ".cursor-plugin"));
  await writeFile(
    path.join(root, ".cursor-plugin", "plugin.json"),
    JSON.stringify({ name: "pstack", version: "1.0.0", skills: "./skills/" }),
  );

  await assert.rejects(() => discoverSource(root), /skills directory/);
});

test("rejects destinations equal to or nested inside the source", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pstack-destination-"));
  await assert.rejects(() => assertSafeDestination(root, root), /outside the source/);
  await assert.rejects(
    () => assertSafeDestination(root, path.join(root, "generated")),
    /outside the source/,
  );
});

test("accepts a sibling destination", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "pstack-destination-"));
  const destination = `${root}-codex`;

  await assert.doesNotReject(() => assertSafeDestination(root, destination));
});

test("rejects a destination that enters the source through a symlinked parent", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "pstack-destination-"));
  const source = path.join(parent, "source");
  const alias = path.join(parent, "source-alias");
  await mkdir(source);
  await symlink(source, alias);

  await assert.rejects(
    () => assertSafeDestination(source, path.join(alias, "generated")),
    /outside the source/,
  );
});
