export function normalizePluginName(value) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_.]+|[-_.]+$/g, "");
  if (!normalized || normalized.length > 64 || !/^[a-z0-9_-]+(?:\.[a-z0-9_-]+)*$/.test(normalized)) {
    throw new Error(`Invalid plugin name: ${value}`);
  }
  return normalized;
}

function safeHttpsUrl(value) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function createCodexPluginManifest(cursorManifest, pluginName) {
  const author = cursorManifest.author?.name || "pstack contributors";
  const homepage = safeHttpsUrl(cursorManifest.homepage);
  const repository = safeHttpsUrl(cursorManifest.repository);
  return {
    name: pluginName,
    version: cursorManifest.version,
    description: `Codex-compatible conversion of ${cursorManifest.displayName || cursorManifest.name}. Review compatibility/report.md before use.`,
    author: { ...cursorManifest.author, name: author },
    homepage,
    repository,
    license: cursorManifest.license || "MIT",
    keywords: [...new Set([...(cursorManifest.keywords || []), "codex"])],
    skills: "./skills/",
    interface: {
      displayName: `${cursorManifest.displayName || "pstack"} for Codex`,
      shortDescription: "Converted pstack engineering workflows",
      longDescription: "A local Codex conversion of pstack. Review the generated compatibility report for omitted or unresolved Cursor-specific behavior.",
      developerName: author,
      category: "Developer Tools",
      capabilities: ["Engineering workflows", "Review and verification"],
      websiteURL: homepage || repository,
      defaultPrompt: [
        "Use $poteto-mode for this engineering task.",
        "Use $architect to design this change.",
        "Use $interrogate to review this change.",
      ],
    },
  };
}

function createClaudePluginManifest(cursorManifest, pluginName) {
  const author = cursorManifest.author?.name || "pstack contributors";
  const homepage = safeHttpsUrl(cursorManifest.homepage);
  const repository = safeHttpsUrl(cursorManifest.repository);
  return {
    name: pluginName,
    version: cursorManifest.version,
    description: `Claude Code-compatible conversion of ${cursorManifest.displayName || cursorManifest.name}. Review compatibility/report.md before use.`,
    author: { ...cursorManifest.author, name: author },
    homepage,
    repository,
    license: cursorManifest.license || "MIT",
    keywords: [...new Set([...(cursorManifest.keywords || []), "claude-code"])],
    skills: "./skills/",
  };
}

export function createPluginManifest(cursorManifest, pluginName, target = "codex") {
  if (target === "claude") return createClaudePluginManifest(cursorManifest, pluginName);
  return createCodexPluginManifest(cursorManifest, pluginName);
}

function createCodexMarketplace(pluginName) {
  return {
    name: `${pluginName}-local`,
    interface: { displayName: `${pluginName} Local` },
    plugins: [
      {
        name: pluginName,
        source: { source: "local", path: `./plugins/${pluginName}` },
        policy: { installation: "AVAILABLE", authentication: "ON_INSTALL" },
        category: "Developer Tools",
      },
    ],
  };
}

function createClaudeMarketplace(pluginName) {
  return {
    $schema: "https://json.schemastore.org/claude-code-marketplace.json",
    name: `${pluginName}-local`,
    owner: { name: "pstack contributors" },
    plugins: [{ name: pluginName, source: `./plugins/${pluginName}` }],
  };
}

export function createMarketplace(pluginName, target = "codex") {
  if (target === "claude") return createClaudeMarketplace(pluginName);
  return createCodexMarketplace(pluginName);
}
