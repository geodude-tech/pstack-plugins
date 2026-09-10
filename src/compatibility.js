import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { rewriteModelReferences } from "./models.js";

const TEXT_EXTENSIONS = new Set([".md", ".txt", ".json", ".toml", ".yaml", ".yml", ".js", ".mjs", ".ts", ".sh"]);

// Codex has no native slash-command or tool equivalent for these Cursor primitives, and no
// native model family of its own, so every host-specific mention is a manual-review finding.
const CODEX_FINDING_PATTERNS = [
  ["cursor-path", /(?:~\/)?\.cursor(?:-plugin)?(?:\/[\w./-]*)?/i, "Replace this Cursor-specific path with an explicit Codex location."],
  ["cursor-command", /\/(?:add-plugin|loop)\b/i, "This Cursor command has no automatic Codex equivalent."],
  ["cursor-tool", /\b(?:AskUserQuestion|Agent tool|Cursor Agent)\b/i, "Map this Cursor tool or agent behavior to an available Codex capability."],
  ["model-identifier", /\b(?:claude-[\w.-]+|grok(?:-[\w.-]+)?|opus(?:\s+\d+(?:\.\d+)?)?|fable(?:\s+\d+(?:\.\d+)?)?)\b/i, "Choose an available Codex model instead of preserving this host-specific model identifier."],
];

// Claude Code already ships AskUserQuestion, an Agent tool, and a /loop skill, and claude-*
// identifiers are its own native model names, so only genuinely unmapped Cursor constructs
// (and non-Claude model names) are worth flagging here.
const CLAUDE_FINDING_PATTERNS = [
  ["cursor-path", /(?:~\/)?\.cursor(?:-plugin)?(?:\/[\w./-]*)?/i, "Replace this Cursor-specific path with an explicit Claude Code location (e.g. .claude/ or the plugin's skills/ tree)."],
  ["cursor-command", /\/add-plugin\b/i, "This Cursor command has no automatic Claude Code equivalent; use `/plugin marketplace add` and `/plugin install` instead."],
  ["cursor-tool", /\bCursor Agent\b/i, "Map this Cursor-specific agent behavior to an available Claude Code capability."],
  ["model-identifier", /\bgrok(?:-[\w.-]+)?\b|(?<!claude-)\b(?:opus|fable)\b(?:[\s-]\d+(?:\.\d+)?)?/i, "Choose an available Claude model instead of preserving this host-specific model identifier."],
];

const FINDING_PATTERNS_BY_TARGET = { codex: CODEX_FINDING_PATTERNS, claude: CLAUDE_FINDING_PATTERNS };

// Codex references a skill by name with a `$` sigil (see manifest.js defaultPrompt); Claude Code
// has no such sigil, so a rewritten invocation there drops the leading slash and nothing else.
const SIGIL_BY_TARGET = { codex: "$", claude: "" };

function regexForSkillNames(skillNames, prefix) {
  const names = [...skillNames]
    .sort((left, right) => right.length - left.length)
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (names.length === 0) return null;
  return new RegExp(`${prefix}(${names.join("|")})(?=\\b)`, "gm");
}

function lineNumberAt(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

export function rewriteSkillInvocations(text, skillNames, sigil = "$") {
  const rewrites = [];
  let rewritten = text;
  const patterns = [regexForSkillNames(skillNames, "`/"), regexForSkillNames(skillNames, "^/")].filter(Boolean);

  for (const pattern of patterns) {
    rewritten = rewritten.replace(pattern, (match, skillName, offset) => {
      const replacement = match.startsWith("`") ? `\`${sigil}${skillName}` : `${sigil}${skillName}`;
      rewrites.push({ line: lineNumberAt(rewritten, offset), before: match, after: replacement });
      return replacement;
    });
  }

  return { text: rewritten, rewrites };
}

export function normalizeSkillFrontmatter(text) {
  if (!text.startsWith("---\n")) return { text, rewrites: [] };
  const frontmatterEnd = text.indexOf("\n---", 4);
  if (frontmatterEnd === -1) return { text, rewrites: [] };
  const frontmatter = text.slice(0, frontmatterEnd);
  const pattern = /^disable-model-invocation:\s*true\s*$/m;
  const match = pattern.exec(frontmatter);
  if (!match) return { text, rewrites: [] };
  const replacement = "disable-model-invocation: false";
  return {
    text: `${frontmatter.replace(pattern, replacement)}${text.slice(frontmatterEnd)}`,
    rewrites: [{
      line: lineNumberAt(text, match.index),
      before: match[0],
      after: replacement,
    }],
  };
}

// A frontmatter `name` that doesn't match its directory (Cursor tolerates a spaced
// display name here) breaks skill/slash-command resolution on both Codex and Claude Code.
export function normalizeSkillName(text, expectedName) {
  if (!text.startsWith("---\n")) return { text, rewrites: [] };
  const frontmatterEnd = text.indexOf("\n---", 4);
  if (frontmatterEnd === -1) return { text, rewrites: [] };
  const frontmatter = text.slice(0, frontmatterEnd);
  const pattern = /^name:\s*(.+?)\s*$/m;
  const match = pattern.exec(frontmatter);
  if (!match || match[1] === expectedName) return { text, rewrites: [] };
  const replacement = `name: ${expectedName}`;
  return {
    text: `${frontmatter.replace(pattern, replacement)}${text.slice(frontmatterEnd)}`,
    rewrites: [{
      line: lineNumberAt(text, match.index),
      before: match[0],
      after: replacement,
    }],
  };
}

async function listTextFiles(root, current = root) {
  const files = [];
  for (const entry of (await readdir(current)).sort()) {
    const fullPath = path.join(current, entry);
    const metadata = await lstat(fullPath);
    if (metadata.isSymbolicLink()) throw new Error(`Symlinks are not allowed: ${fullPath}`);
    if (metadata.isDirectory()) files.push(...await listTextFiles(root, fullPath));
    else if (metadata.isFile() && TEXT_EXTENSIONS.has(path.extname(entry))) files.push(fullPath);
  }
  return files;
}

function scanText(text, relativePath, findingPatterns) {
  const findings = [];
  for (const [index, line] of text.split("\n").entries()) {
    for (const [code, pattern, message] of findingPatterns) {
      const match = line.match(pattern);
      if (match) findings.push({ code, file: relativePath, line: index + 1, match: match[0], message });
    }
  }
  return findings;
}

function markdownReport(report) {
  const lines = [
    "# pstack compatibility report",
    "",
    `Rewrites: ${report.summary.rewrites}`,
    `Manual-review findings: ${report.summary.findings}`,
    "",
    "The converter applies only exact skill-invocation rewrites. Every finding below needs human review before semantic parity can be claimed.",
    "",
    "## Findings",
    "",
  ];
  if (report.findings.length === 0) lines.push("No manual-review findings.");
  for (const finding of report.findings) {
    const location = finding.line ? `${finding.file}:${finding.line}` : finding.file;
    lines.push(`- **${finding.code}** at \`${location}\`: ${finding.message} (\`${finding.match}\`)`);
  }
  lines.push("", "## Rewrites", "");
  if (report.rewrites.length === 0) lines.push("No automatic rewrites.");
  for (const rewrite of report.rewrites) {
    lines.push(`- \`${rewrite.file}:${rewrite.line}\`: \`${rewrite.before}\` → \`${rewrite.after}\``);
  }
  return `${lines.join("\n")}\n`;
}

export async function applyCompatibility(pluginRoot, omittedPaths, target = "codex") {
  const targetLabel = target === "claude" ? "Claude Code" : "Codex";
  const findingPatterns = FINDING_PATTERNS_BY_TARGET[target] || FINDING_PATTERNS_BY_TARGET.codex;
  const sigil = SIGIL_BY_TARGET[target] ?? SIGIL_BY_TARGET.codex;
  const skillsRoot = path.join(pluginRoot, "skills");
  const skillNames = new Set((await readdir(skillsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name));
  const rewrites = [];
  const findings = omittedPaths.map((omittedPath) => ({
    code: "omitted-component",
    file: omittedPath,
    line: null,
    match: omittedPath,
    message: `This Cursor runtime component was not copied into ${targetLabel} executable discovery.`,
  }));

  for (const file of await listTextFiles(pluginRoot)) {
    const relativePath = path.relative(pluginRoot, file);
    let text = await readFile(file, "utf8");
    if (target === "claude") {
      const models = rewriteModelReferences(text);
      text = models.text;
      rewrites.push(...models.rewrites.map((rewrite) => ({ ...rewrite, file: relativePath })));
      if (models.rewrites.length > 0) await writeFile(file, text);
    }
    if (path.extname(file) === ".md") {
      let frontmatterRewrites = [];
      if (path.basename(file) === "SKILL.md") {
        const disableInvocation = normalizeSkillFrontmatter(text);
        const skillName = normalizeSkillName(disableInvocation.text, path.basename(path.dirname(file)));
        text = skillName.text;
        frontmatterRewrites = [...disableInvocation.rewrites, ...skillName.rewrites];
      }
      const invocations = rewriteSkillInvocations(text, skillNames, sigil);
      text = invocations.text;
      const fileRewrites = [...frontmatterRewrites, ...invocations.rewrites];
      rewrites.push(...fileRewrites.map((rewrite) => ({ ...rewrite, file: relativePath })));
      if (fileRewrites.length > 0) await writeFile(file, text);
    }
    findings.push(...scanText(text, relativePath, findingPatterns));
  }

  const report = {
    summary: { rewrites: rewrites.length, findings: findings.length },
    rewrites,
    findings,
  };
  return { report, markdown: markdownReport(report) };
}
