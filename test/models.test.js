import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { convertPstack } from "../src/conversion.js";
import { rewriteModelReferences } from "../src/models.js";
import { createCursorPstack } from "./helpers.js";

test("rewrites Cursor model slugs and the rule path to Claude Code subagents", () => {
  const source = "default `grok-4.6-fast-xhigh`, panel `gpt-5.6-sol-max`, rule ~/.cursor/rules/pstack-models.mdc\n";

  const result = rewriteModelReferences(source);

  assert.equal(
    result.text,
    "default `pstack-fast`, panel `pstack-judgment`, rule ~/.claude/rules/pstack-models.md\n",
  );
  assert.equal(result.rewrites.length, 3);
  assert.deepEqual(rewriteModelReferences(result.text).rewrites, []);
});

test("Claude Code target emits agent definitions carrying model and effort", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-models-source-"));
  const source = await createCursorPstack(sourceParent);
  await writeFile(
    path.join(source, "skills", "poteto-mode", "SKILL.md"),
    "---\nname: poteto-mode\ndescription: rigorous work\n---\n\nDelegate code to `grok-4.6-fast-xhigh`.\n",
  );

  const result = await convertPstack({ sourcePath: source, destination: `${sourceParent}-output`, target: "claude" });

  const fast = await readFile(path.join(result.pluginRoot, "agents", "pstack-fast.md"), "utf8");
  assert.match(fast, /^model: sonnet$/m);
  assert.match(fast, /^effort: high$/m);
  const judgment = await readFile(path.join(result.pluginRoot, "agents", "pstack-judgment.md"), "utf8");
  assert.match(judgment, /^model: fable$/m);
  assert.match(judgment, /^effort: low$/m);
  assert.match(
    await readFile(path.join(result.pluginRoot, "skills", "poteto-mode", "SKILL.md"), "utf8"),
    /Delegate code to `pstack-fast`\./,
  );
  assert.match(await readFile(path.join(result.pluginRoot, "NOTICE.generated.md"), "utf8"), /## Model routing/);
  assert.ok(!result.compatibility.findings.some((finding) => finding.match === "grok-4.6-fast-xhigh"));
});

test("Codex target leaves Cursor model slugs untouched", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-models-source-"));
  const source = await createCursorPstack(sourceParent);
  await writeFile(
    path.join(source, "skills", "poteto-mode", "SKILL.md"),
    "---\nname: poteto-mode\ndescription: rigorous work\n---\n\nDelegate code to `grok-4.6-fast-xhigh`.\n",
  );

  const result = await convertPstack({ sourcePath: source, destination: `${sourceParent}-output` });

  assert.match(
    await readFile(path.join(result.pluginRoot, "skills", "poteto-mode", "SKILL.md"), "utf8"),
    /grok-4\.6-fast-xhigh/,
  );
  await assert.rejects(readFile(path.join(result.pluginRoot, "agents", "pstack-fast.md")));
});
