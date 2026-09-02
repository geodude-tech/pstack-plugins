import assert from "node:assert/strict";
import { lstat, mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { parseArgs, runCli } from "../src/cli.js";
import { createCursorPstack } from "./helpers.js";

function captureIo() {
  const stdout = [];
  const stderr = [];
  return {
    stdout,
    stderr,
    io: {
      stdout: { write: (value) => stdout.push(value) },
      stderr: { write: (value) => stderr.push(value) },
    },
  };
}

test("parses the documented command-line contract", () => {
  assert.deepEqual(
    parseArgs(["/src", "--out", "/dest", "--name", "Team PStack", "--force", "--json"]),
    { sourcePath: "/src", destination: "/dest", name: "Team PStack", force: true, dryRun: false, json: true, target: "codex" },
  );
  assert.deepEqual(
    parseArgs(["/src", "--out", "/dest", "--target", "claude"]).target,
    "claude",
  );
  assert.throws(() => parseArgs([]), /source path is required/);
  assert.throws(() => parseArgs(["/src"]), /--out is required/);
  assert.throws(() => parseArgs(["/src", "--out", "/dest", "--wat"]), /Unknown option/);
  assert.throws(() => parseArgs(["/src", "--out", "/dest", "--target", "cursor"]), /Unknown target: cursor/);
});

test("dry-run reports findings without creating the destination", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-cli-source-"));
  const source = await createCursorPstack(sourceParent);
  const destination = `${sourceParent}-preview`;
  const capture = captureIo();

  const exitCode = await runCli([source, "--out", destination, "--dry-run", "--json"], capture.io);

  assert.equal(exitCode, 2);
  const output = JSON.parse(capture.stdout.join(""));
  assert.equal(output.dryRun, true);
  assert.ok(output.compatibility.summary.findings > 0);
  await assert.rejects(() => lstat(destination), /ENOENT/);
});

test("human output includes generated path and review guidance", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-cli-source-"));
  const source = await createCursorPstack(sourceParent);
  const destination = `${sourceParent}-output`;
  const capture = captureIo();

  const exitCode = await runCli([source, "--out", destination], capture.io);

  assert.equal(exitCode, 2);
  assert.match(capture.stdout.join(""), /Generated pstack-for-codex/);
  assert.match(capture.stdout.join(""), /compatibility\/report\.md/);
  assert.equal(capture.stderr.join(""), "");
});

test("--target claude generates a Claude Code plugin tree", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-cli-source-"));
  const source = await createCursorPstack(sourceParent);
  const destination = `${sourceParent}-output`;
  const capture = captureIo();

  const exitCode = await runCli([source, "--out", destination, "--target", "claude"], capture.io);

  assert.equal(exitCode, 2);
  assert.match(capture.stdout.join(""), /Generated pstack-for-claude/);
  assert.equal(
    (await lstat(path.join(destination, "plugins", "pstack-for-claude", ".claude-plugin", "plugin.json"))).isFile(),
    true,
  );
});

test("force replaces converter-owned output", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-cli-source-"));
  const source = await createCursorPstack(sourceParent);
  const destination = `${sourceParent}-output`;
  await runCli([source, "--out", destination], captureIo().io);
  await writeFile(path.join(destination, "stale.txt"), "old\n");

  const exitCode = await runCli([source, "--out", destination, "--force"], captureIo().io);

  assert.equal(exitCode, 2);
  await assert.rejects(() => lstat(path.join(destination, "stale.txt")), /ENOENT/);
  assert.equal(JSON.parse(await readFile(path.join(destination, ".pstack-to-codex.json"))).generator, "pstack-to-codex");
});

test("force refuses to replace output without an ownership receipt", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-cli-source-"));
  const source = await createCursorPstack(sourceParent);
  const destination = `${sourceParent}-unowned`;
  await mkdir(destination);
  await writeFile(path.join(destination, "important.txt"), "keep me\n");
  const capture = captureIo();

  const exitCode = await runCli([source, "--out", destination, "--force"], capture.io);

  assert.equal(exitCode, 1);
  assert.match(capture.stderr.join(""), /not owned by pstack-to-codex/);
  assert.equal(await readFile(path.join(destination, "important.txt"), "utf8"), "keep me\n");
});

test("force preserves the previous output when regeneration fails", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-cli-source-"));
  const source = await createCursorPstack(sourceParent);
  const destination = `${sourceParent}-output`;
  await runCli([source, "--out", destination], captureIo().io);
  await writeFile(path.join(destination, "keep-until-success.txt"), "previous output\n");
  await symlink("../../../LICENSE", path.join(source, "skills", "poteto-mode", "bad-link"));

  const exitCode = await runCli([source, "--out", destination, "--force"], captureIo().io);

  assert.equal(exitCode, 1);
  assert.equal(
    await readFile(path.join(destination, "keep-until-success.txt"), "utf8"),
    "previous output\n",
  );
});
