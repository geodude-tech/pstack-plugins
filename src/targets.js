const TARGETS = {
  codex: {
    id: "codex",
    label: "Codex",
    manifestDir: ".codex-plugin",
    marketplacePath: [".agents", "plugins", "marketplace.json"],
    defaultBaseName: "pstack-for-codex",
    vendorNote: "not an official Cursor or OpenAI project",
  },
  claude: {
    id: "claude",
    label: "Claude Code",
    manifestDir: ".claude-plugin",
    marketplacePath: [".claude-plugin", "marketplace.json"],
    defaultBaseName: "pstack-for-claude",
    vendorNote: "not an official Cursor or Anthropic project",
  },
};

export const TARGET_IDS = Object.keys(TARGETS);

export function resolveTarget(id = "codex") {
  const target = TARGETS[id];
  if (!target) throw new Error(`Unknown target: ${id}. Supported targets: ${TARGET_IDS.join(", ")}`);
  return target;
}
