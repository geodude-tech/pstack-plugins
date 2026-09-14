// Cursor packs model and reasoning effort into one slug (`grok-4.6-fast-xhigh`). Claude Code
// takes `model` on the Agent call but `effort` only from an agent definition's frontmatter, so
// each Cursor slug becomes a plugin subagent that carries both, and skills name it with
// `subagent_type` instead of `model`.
export const CLAUDE_AGENTS = [
  {
    name: "pstack-judgment",
    model: "fable",
    effort: "low",
    slugs: ["claude-fable-5-1-thinking-max", "claude-opus-5-thinking-xhigh"],
    description: "pstack judgment role: prose, review, synthesis, panel seats, and the hardest code changes. Fable 5.1 at low effort.",
  },
  {
    name: "pstack-fast",
    model: "sonnet",
    effort: "medium",
    slugs: ["grok-4.6-fast-xhigh"],
    description: "pstack fast code role: scoped implementation delegates, explorers, and swarm workers. Sonnet 5 at medium effort.",
  },
  {
    name: "pstack-balanced",
    model: "opus",
    effort: "medium",
    slugs: ["gpt-5.6-sol-max"],
    description: "pstack balanced role: reflect tooling and one seat in each panel. Opus at medium effort.",
  },
];

const CURSOR_RULE_PATH = "~/.cursor/rules/pstack-models.mdc";
const CLAUDE_RULE_PATH = "~/.claude/rules/pstack-models.md";

const SLUG_TO_AGENT = new Map(CLAUDE_AGENTS.flatMap((agent) => agent.slugs.map((slug) => [slug, agent.name])));
const SLUG_PATTERN = new RegExp(
  [...SLUG_TO_AGENT.keys()].map((slug) => slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"),
  "g",
);

function lineNumberAt(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

export function rewriteModelReferences(text) {
  const rewrites = [];
  let rewritten = text.replace(SLUG_PATTERN, (match, offset) => {
    const replacement = SLUG_TO_AGENT.get(match);
    rewrites.push({ line: lineNumberAt(text, offset), before: match, after: replacement });
    return replacement;
  });
  rewritten = rewritten.split(CURSOR_RULE_PATH).join(CLAUDE_RULE_PATH);
  for (let offset = text.indexOf(CURSOR_RULE_PATH); offset !== -1; offset = text.indexOf(CURSOR_RULE_PATH, offset + 1)) {
    rewrites.push({ line: lineNumberAt(text, offset), before: CURSOR_RULE_PATH, after: CLAUDE_RULE_PATH });
  }
  return { text: rewritten, rewrites };
}

export function agentDefinition(agent) {
  return [
    "---",
    `name: ${agent.name}`,
    `description: ${agent.description}`,
    `model: ${agent.model}`,
    `effort: ${agent.effort}`,
    "---",
    "",
    `You are the pstack \`${agent.name}\` subagent. Skills that named the Cursor models ${agent.slugs.map((slug) => `\`${slug}\``).join(", ")} now spawn you instead.`,
    "",
    "Follow the scope in your prompt exactly. Return file pointers and a short summary, not inlined file contents.",
    "",
  ].join("\n");
}

// Only these rule lines are read by a converted Claude skill (arena, interrogate, swarm). The
// other upstream roles are hard-coded to a subagent name, so a rule line for them is dead.
const CLAUDE_RULE_ROLES = ["arena runners", "arena cross-judge pool", "interrogate reviewers", "swarm workers"];

function setupDefaults(text) {
  const frontmatterEnd = text.indexOf("\n---", 4);
  const defaults = text.match(/^feature, refactoring:[^\n]*[\s\S]*?^interrogate reviewers:[^\n]*$/m)?.[0];
  if (frontmatterEnd === -1 || !defaults) {
    throw new Error("Unrecognized setup-pstack structure; review the upstream setup workflow before converting it.");
  }
  return { frontmatter: text.slice(0, frontmatterEnd + 4), defaults };
}

export function claudeSetupInstructions(text) {
  const { frontmatter, defaults } = setupDefaults(rewriteModelReferences(text).text);
  const roleLines = defaults.split("\n").filter((line) => CLAUDE_RULE_ROLES.some((role) => line.startsWith(`${role}:`)));
  if (roleLines.length !== CLAUDE_RULE_ROLES.length) {
    throw new Error("Unrecognized setup-pstack role list; review the upstream setup workflow before converting it.");
  }
  const description = "Configure which pstack subagent fills each panel seat and how many seats each panel has. Writes an always-applied rule that overrides the skill defaults. Use for /setup-pstack, \"configure pstack models\", \"pstack budget\", or changing pstack's model choices.";
  return `${frontmatter.replace(/^description:.*$/m, `description: ${description}`)}

# Setup pstack

Write \`${CLAUDE_RULE_PATH}\`, an always-applied rule that sets which pstack subagent fills each panel seat and how many seats each panel has.

## What the rule can and cannot change

Model and reasoning effort are fixed per subagent in this plugin's \`agents/<name>.md\` files. The rule picks among these subagents; it cannot change their model or effort.

| Subagent | Effort | Role |
| --- | --- | --- |
${CLAUDE_AGENTS.map((agent) => `| \`${agent.name}\` | ${agent.effort} | ${agent.description.match(/^[^:]*: (.*?)\. /)[1]} |`).join("\n")}

Only the roles below read the rule. Every other pstack skill names its subagent directly, so a rule line for another role has no effect. The list length sets the seat count: one subagent runs per entry, alias entries included. Panel seats are the main cost lever; fewer seats cost less than any single model change.

## Steps

1. Read \`${CLAUDE_RULE_PATH}\` if it exists and treat its role values as the current choices. Otherwise start from the defaults below.
2. Show every role with its value. Ask whether to accept as-is or change specific roles. Prefer AskUserQuestion over free text. Offer the three subagents plus \`inherit-parent\` and \`auto\`, which both mean the seat runs on the parent chat model (omit \`subagent_type\`). For \`arena cross-judge pool\` Arena selects one entry whose model differs from the parent's when possible. \`swarm workers\` is the default for every worker unless a race or comparison assigns another per arm.
3. Validate: every entry must be one of the subagent names above, \`inherit-parent\`, or \`auto\`. If not, ask again.
4. Write the whole file so re-runs stay idempotent:

\`\`\`
---
description: pstack per-role model choices (overrides skill defaults)
alwaysApply: true
---
# pstack panel configuration. One line per role. Delete a line to fall back to the skill default.
# Values are this plugin's subagent names. Model and effort live in the plugin's agents/ files.
# \`inherit-parent\` or \`auto\` as a value: the seat runs on the parent chat model (omit subagent_type). Alias entries still count toward the fan-out.
${roleLines.join("\n")}
\`\`\`

5. Tell the user the rule was written and that it applies to new sessions. Re-running this skill updates it.
6. Check whether the project has a way to drive the real app for proof (a \`verify-*\` skill, or an existing harness). If not, offer once to generate one with /create-verification-skill. On no, move on without pushing.
`;
}

export const CODEX_ROLES = [
  { name: "pstack-judgment", model: "gpt-6-astra", effort: "low", slugs: CLAUDE_AGENTS[0].slugs },
  { name: "pstack-fast", model: "gpt-5.6-luna", effort: "high", slugs: CLAUDE_AGENTS[1].slugs },
  { name: "pstack-balanced", model: "gpt-5.6-sol", effort: "medium", slugs: CLAUDE_AGENTS[2].slugs },
];

export function codexModelRouting() {
  return [
    "## Codex model routing",
    "",
    "Before delegating, read `~/.codex/pstack-models.md` if it exists. Its per-role choices override these defaults.",
    "",
    "| Role alias | Model | Reasoning effort |",
    "| --- | --- | --- |",
    ...CODEX_ROLES.map((role) => `| ${role.name} | ${role.model} | ${role.effort} |`),
    "",
    "These aliases are routing labels, not model IDs or registered agent types. Resolve an alias before spawning and pass the model and reasoning effort separately using the available subagent tool. With `collaboration.spawn_agent`, use `model` and `reasoning_effort`; explicit overrides require `fork_turns` to be `none` or a positive turn count, with sufficient task context in the prompt.",
    "",
    "Check the session's available models and effort levels before spawning. If a configured pair is unavailable, ask for a supported replacement. For `inherit-parent` or `auto`, omit both overrides. If the host cannot select a model or effort, report that limitation rather than claim the requested routing was applied.",
    "",
    "Keep every panel entry, including repeated aliases, as a separate agent. These defaults do not provide cross-provider diversity; do not claim that repeated roles are different model families.",
    "",
  ].join("\n");
}

export function rewriteCodexModelReferences(text, includeRouting = false) {
  const roles = new Map(CODEX_ROLES.flatMap((role) => role.slugs.map((slug) => [slug, role.name])));
  const rewrites = [];
  let rewritten = text.replace(SLUG_PATTERN, (match, offset) => {
    const replacement = roles.get(match);
    rewrites.push({ line: lineNumberAt(text, offset), before: match, after: replacement });
    return replacement;
  });
  rewritten = rewritten.split(CURSOR_RULE_PATH).join("~/.codex/pstack-models.md");
  for (let offset = text.indexOf(CURSOR_RULE_PATH); offset !== -1; offset = text.indexOf(CURSOR_RULE_PATH, offset + 1)) {
    rewrites.push({ line: lineNumberAt(text, offset), before: CURSOR_RULE_PATH, after: "~/.codex/pstack-models.md" });
  }
  if (includeRouting && rewrites.length > 0 && !rewritten.includes("## Codex model routing")) {
    const routing = codexModelRouting();
    rewrites.push({ line: rewritten.split("\n").length + 1, before: "", after: "Added Codex model routing instructions" });
    rewritten = `${rewritten.trimEnd()}\n\n${routing}`;
  }
  return { text: rewritten, rewrites };
}

export function codexSetupInstructions(text) {
  const { frontmatter, defaults } = setupDefaults(text);
  return `${frontmatter.replace("writes an always-applied rule", "writes a Codex preference file")}

# Setup pstack

Configure pstack's per-role model and reasoning effort in \`~/.codex/pstack-models.md\`. This is a pstack preference file, read explicitly by the converted workflows, not an automatically loaded Codex rule.

## Steps

1. Inspect the current subagent tool for available models and supported reasoning efforts. Never assume an API model is available in this Codex session. If detection is unavailable, ask the user for their supported choices.
2. Read \`~/.codex/pstack-models.md\` if it exists. Preserve current choices as the starting point; otherwise use the defaults below.
3. Show every role and its model and effort. Ask the user to accept the mapping or change specific roles. Offer \`inherit-parent\` and \`auto\` as aliases that omit both model and effort overrides. Each panel list entry creates one agent, including repeated entries.
4. Validate every selected model and effort against the session's supported values. If a pair is unavailable, ask for a supported replacement before writing.
5. Write the complete preference file below, using the confirmed values. Keep both the alias definitions and the per-role mapping. For a custom choice, define another alias with its model and reasoning effort, then use that alias on the relevant role lines. This file belongs only to pstack; do not overwrite \`AGENTS.md\` or \`config.toml\`.

\`\`\`text
# pstack model preferences
${CODEX_ROLES.map((role) => `${role.name}: model=${role.model}, reasoning_effort=${role.effort}`).join("\n")}

${defaults}
\`\`\`

6. Report the saved choices. Converted workflows read this file before delegating; re-running setup updates the choices.
`;
}
