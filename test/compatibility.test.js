import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { convertPstack } from "../src/conversion.js";
import { rewriteSkillInvocations } from "../src/compatibility.js";
import { createCursorPstack } from "./helpers.js";

test("rewrites only invocations that resolve to copied skills", () => {
  const source = "Use `/poteto-mode`, then `/loop`, and keep /api/tasks unchanged.\n/setup-pstack now\n";

  const result = rewriteSkillInvocations(source, new Set(["poteto-mode", "setup-pstack"]));

  assert.equal(
    result.text,
    "Use `$poteto-mode`, then `/loop`, and keep /api/tasks unchanged.\n$setup-pstack now\n",
  );
  assert.equal(result.rewrites.length, 2);
});

test("writes matching JSON and Markdown compatibility reports", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-compat-source-"));
  const source = await createCursorPstack(sourceParent);
  const destination = `${sourceParent}-output`;

  const result = await convertPstack({ sourcePath: source, destination });
  const pluginRoot = result.pluginRoot;
  const report = JSON.parse(
    await readFile(path.join(pluginRoot, "compatibility", "report.json"), "utf8"),
  );
  const markdown = await readFile(path.join(pluginRoot, "compatibility", "report.md"), "utf8");

  assert.equal(report.summary.rewrites, 4);
  assert.ok(report.summary.findings >= 5);
  assert.match(markdown, new RegExp(`Rewrites: ${report.summary.rewrites}`));
  assert.match(markdown, new RegExp(`Manual-review findings: ${report.summary.findings}`));
  assert.ok(report.findings.some((finding) => finding.code === "cursor-path"));
  assert.ok(report.findings.some((finding) => finding.code === "cursor-tool"));
  assert.ok(report.findings.some((finding) => finding.code === "model-identifier"));
  assert.ok(report.findings.some((finding) => finding.code === "omitted-component"));

  assert.match(
    await readFile(path.join(pluginRoot, "skills", "poteto-mode", "SKILL.md"), "utf8"),
    /disable-model-invocation: false[\s\S]*Use `\$poteto-mode`/,
  );
  assert.match(
    await readFile(path.join(pluginRoot, "docs", "guide.md"), "utf8"),
    /Use `\$setup-pstack`/,
  );
});

test("generates an attribution notice tied to the source version", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-compat-source-"));
  const source = await createCursorPstack(sourceParent);
  const destination = `${sourceParent}-output`;

  const result = await convertPstack({ sourcePath: source, destination });
  const notice = await readFile(path.join(result.pluginRoot, "NOTICE.generated.md"), "utf8");

  assert.match(notice, /pstack version 0\.14\.6/);
  assert.match(notice, /not an official Cursor or OpenAI project/);
  assert.match(notice, /Review `compatibility\/report\.md`/);
});
