import { execFile } from "node:child_process";
import { copyFile, lstat, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { assertSafeDestination, discoverSource } from "./discovery.js";
import { applyCompatibility } from "./compatibility.js";
import { CLAUDE_AGENTS, agentDefinition, codexModelRouting } from "./models.js";
import { createMarketplace, createPluginManifest, normalizePluginName } from "./manifest.js";
import { resolveTarget } from "./targets.js";
import { validateGeneratedPlugin } from "./validation.js";

const execFileAsync = promisify(execFile);
const COPY_DIRECTORIES = ["skills", "docs", "scripts", "assets"];
const COPY_FILES = ["README.md", "LICENSE", "NOTICE"];
const OMIT_DIRECTORIES = ["agents", "automations", "hooks"];
const DEFAULT_LIMITS = {
  maxFiles: 10_000,
  maxFileBytes: 10 * 1024 * 1024,
  maxTotalBytes: 100 * 1024 * 1024,
};

async function pathExists(candidate) {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function copyTree(source, destination, sourceRoot, copiedFiles, copyState) {
  const metadata = await lstat(source);
  if (metadata.isSymbolicLink()) {
    throw new Error(`Symlinks are not allowed in converted content: ${source}`);
  }
  if (metadata.isDirectory()) {
    await mkdir(destination, { recursive: true });
    const entries = (await readdir(source)).sort();
    for (const entry of entries) {
      await copyTree(
        path.join(source, entry),
        path.join(destination, entry),
        sourceRoot,
        copiedFiles,
        copyState,
      );
    }
    return;
  }
  if (!metadata.isFile()) {
    throw new Error(`Unsupported filesystem entry in source: ${source}`);
  }
  if (metadata.size > copyState.limits.maxFileBytes) {
    throw new Error(`Source file exceeds the file-size limit: ${source}`);
  }
  copyState.files += 1;
  copyState.bytes += metadata.size;
  if (copyState.files > copyState.limits.maxFiles) {
    throw new Error(`Source content exceeds the file-count limit at: ${source}`);
  }
  if (copyState.bytes > copyState.limits.maxTotalBytes) {
    throw new Error(`Source content exceeds the total-size limit at: ${source}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
  copiedFiles.push(path.relative(sourceRoot, source));
}

async function readGitCommit(sourceRoot) {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: sourceRoot });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

function claudeModelNotice() {
  const rows = CLAUDE_AGENTS.map((agent) =>
    `- \`${agent.name}\` (${agent.model}, effort ${agent.effort}) replaces ${agent.slugs.map((slug) => `\`${slug}\``).join(", ")}`);
  return "\n## Model routing\n\n"
    + "Cursor model slugs were rewritten to plugin subagents in `agents/`, because Claude Code sets reasoning effort "
    + "only in an agent definition. Where a skill says `model`, pass the name as `subagent_type` instead.\n\n"
    + `${rows.join("\n")}\n`;
}

export async function convertPstack(options) {
  const source = await discoverSource(options.sourcePath);
  const destination = await assertSafeDestination(source.root, options.destination);
  if (await pathExists(destination)) {
    throw new Error(`Destination already exists: ${destination}`);
  }

  const target = resolveTarget(options.target);
  const pluginName = normalizePluginName(options.name || target.defaultBaseName);
  const pluginRoot = path.join(destination, "plugins", pluginName);
  const copiedFiles = [];
  const omittedPaths = [];
  const copyState = {
    files: 0,
    bytes: 0,
    limits: { ...DEFAULT_LIMITS, ...options.limits },
  };

  for (const directory of COPY_DIRECTORIES) {
    const sourcePath = path.join(source.root, directory);
    if (await pathExists(sourcePath)) {
      await copyTree(sourcePath, path.join(pluginRoot, directory), source.root, copiedFiles, copyState);
    }
  }
  for (const filename of COPY_FILES) {
    const sourcePath = path.join(source.root, filename);
    if (await pathExists(sourcePath)) {
      await copyTree(sourcePath, path.join(pluginRoot, filename), source.root, copiedFiles, copyState);
    }
  }
  for (const directory of OMIT_DIRECTORIES) {
    if (await pathExists(path.join(source.root, directory))) omittedPaths.push(directory);
  }

  const pluginManifest = createPluginManifest(source.manifest, pluginName, target.id);
  await writeJson(path.join(pluginRoot, target.manifestDir, "plugin.json"), pluginManifest);
  await writeJson(
    path.join(destination, ...target.marketplacePath),
    createMarketplace(pluginName, target.id),
  );

  const sourceCommit = await readGitCommit(source.root);
  const compatibility = await applyCompatibility(pluginRoot, omittedPaths, target.id);
  await writeJson(path.join(pluginRoot, "compatibility", "report.json"), compatibility.report);
  await writeFile(path.join(pluginRoot, "compatibility", "report.md"), compatibility.markdown);
  await writeFile(
    path.join(pluginRoot, "NOTICE.generated.md"),
    `# Generated attribution notice\n\nThis plugin was converted from pstack version ${source.manifest.version}`
      + `${sourceCommit ? ` at commit ${sourceCommit}` : ""}.\n\n`
      + "pstack originates in the Cursor plugins repository and is distributed under its declared license. "
      + `This generated conversion is ${target.vendorNote}.\n\n`
      + "Review `compatibility/report.md` before using the generated workflows.\n"
      + (target.id === "claude" ? claudeModelNotice() : `\n${codexModelRouting()}`),
  );
  if (target.id === "claude") {
    await mkdir(path.join(pluginRoot, "agents"), { recursive: true });
    for (const agent of CLAUDE_AGENTS) {
      await writeFile(path.join(pluginRoot, "agents", `${agent.name}.md`), agentDefinition(agent));
    }
  }
  const validation = await validateGeneratedPlugin(destination, pluginName, target.id);

  const receipt = {
    generator: "pstack-to-codex",
    generatedAt: new Date().toISOString(),
    target: target.id,
    plugin: { name: pluginName, version: pluginManifest.version },
    source: {
      path: source.root,
      version: source.manifest.version,
      commit: sourceCommit,
    },
    copiedFiles: copiedFiles.sort(),
    copiedBytes: copyState.bytes,
    omittedPaths: omittedPaths.sort(),
    compatibility: compatibility.report.summary,
    validation,
  };
  await writeJson(path.join(destination, ".pstack-to-codex.json"), receipt);

  return { destination, pluginName, pluginRoot, receipt, compatibility: compatibility.report, validation };
}
