import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { convertPstack } from "../src/conversion.js";
import { CODEX_ROLES, codexSetupInstructions, rewriteModelReferences, rewriteCodexModelReferences } from "../src/models.js";
import { createCursorPstack } from "./helpers.js";

test("rewrites Cursor model slugs and the rule path to Claude Code subagents", () => {
  const source = "default `grok-4.6-fast-xhigh`, panel `gpt-5.6-sol-max`, rule ~/.cursor/rules/pstack-models.mdc\n";

  const result = rewriteModelReferences(source);

  assert.equal(
    result.text,
    "default `pstack-fast`, panel `pstack-balanced`, rule ~/.claude/rules/pstack-models.md\n",
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
  const balanced = await readFile(path.join(result.pluginRoot, "agents", "pstack-balanced.md"), "utf8");
  assert.match(balanced, /^model: opus$/m);
  assert.match(balanced, /^effort: medium$/m);
  assert.match(
    await readFile(path.join(result.pluginRoot, "skills", "poteto-mode", "SKILL.md"), "utf8"),
    /Delegate code to `pstack-fast`\./,
  );
  assert.match(await readFile(path.join(result.pluginRoot, "NOTICE.generated.md"), "utf8"), /## Model routing/);
  assert.ok(!result.compatibility.findings.some((finding) => finding.match === "grok-4.6-fast-xhigh"));
});

test("Codex target resolves model roles and includes spawn instructions", async () => {
  const sourceParent = await mkdtemp(path.join(tmpdir(), "pstack-models-source-"));
  const source = await createCursorPstack(sourceParent);
  await writeFile(
    path.join(source, "skills", "poteto-mode", "SKILL.md"),
    "---\nname: poteto-mode\ndescription: rigorous work\n---\n\nDelegate code to `grok-4.6-fast-xhigh`.\n",
  );

  const result = await convertPstack({ sourcePath: source, destination: `${sourceParent}-output` });

  assert.match(
    await readFile(path.join(result.pluginRoot, "skills", "poteto-mode", "SKILL.md"), "utf8"),
    /pstack-fast/,
  );
  await assert.rejects(readFile(path.join(result.pluginRoot, "agents", "pstack-fast.md")));
});

test("Codex maps every known slug, preserves panel count, and is idempotent", () => {
  const slugs = CODEX_ROLES.flatMap((role) => role.slugs);
  const result = rewriteCodexModelReferences(slugs.join(", ") + "\n~/.cursor/rules/pstack-models.mdc", true);
  assert.equal(result.text.split("\n")[0], "pstack-judgment, pstack-judgment, pstack-fast, pstack-balanced");
  assert.match(result.text, /gpt-6-astra \| low/);
  assert.match(result.text, /gpt-5.6-luna \| high/);
  assert.match(result.text, /gpt-5.6-sol \| medium/);
  assert.match(result.text, /reasoning_effort/);
  assert.match(result.text, /~\/\.codex\/pstack-models\.md/);
  assert.deepEqual(rewriteCodexModelReferences(result.text, true), { text: result.text, rewrites: [] });
  assert.equal(rewriteCodexModelReferences("unknown-model").text, "unknown-model");
});

test("Codex setup keeps role defaults without Cursor rule metadata or trailing steps", () => {
  const source = "---\nname: setup-pstack\ndescription: setup\n---\n# Setup\n```\nalwaysApply: true\nfeature, refactoring: grok-4.6-fast-xhigh\ninterrogate reviewers: gpt-5.6-sol-max, grok-4.6-fast-xhigh\n```\nUnrelated trailing steps\n";
  const result = rewriteCodexModelReferences(codexSetupInstructions(source), true).text;
  assert.match(result, /feature, refactoring: pstack-fast/);
  assert.match(result, /interrogate reviewers: pstack-balanced, pstack-fast/);
  assert.match(result, /reasoning_effort=high/);
  assert.doesNotMatch(result, /alwaysApply|Unrelated trailing steps|\.cursor/);
  assert.throws(() => codexSetupInstructions("changed upstream format"), /Unrecognized/);
});
