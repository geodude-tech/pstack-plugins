// Cursor packs model and reasoning effort into one slug (`grok-4.6-fast-xhigh`). Claude Code
// takes `model` on the Agent call but `effort` only from an agent definition's frontmatter, so
// each Cursor slug becomes a plugin subagent that carries both, and skills name it with
// `subagent_type` instead of `model`.
export const CLAUDE_AGENTS = [
  {
    name: "pstack-judgment",
    model: "fable",
    effort: "low",
    slugs: ["claude-fable-5-1-thinking-max", "claude-opus-5-thinking-xhigh", "gpt-5.6-sol-max"],
    description: "pstack judgment role: prose, review, synthesis, panel seats, and the hardest code changes. Fable 5.1 at low effort.",
  },
  {
    name: "pstack-fast",
    model: "sonnet",
    effort: "high",
    slugs: ["grok-4.6-fast-xhigh"],
    description: "pstack fast code role: scoped implementation delegates, explorers, and swarm workers. Sonnet 5 at high effort.",
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
