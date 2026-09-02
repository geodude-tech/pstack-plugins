import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { resolveTarget } from "./targets.js";

const STRICT_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

async function readJson(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    throw new Error(`Required generated file is missing: ${file} (${error.message})`);
  }
  if (text.includes("[TODO:")) throw new Error(`Generated file contains a TODO placeholder: ${file}`);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid generated JSON in ${file}: ${error.message}`);
  }
}

function requireText(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`Plugin manifest requires ${field}`);
}

function requireCommonManifestFields(manifest, pluginName) {
  requireText(manifest.name, "name");
  requireText(manifest.version, "version");
  requireText(manifest.description, "description");
  requireText(manifest.author?.name, "author.name");
  if (manifest.name !== pluginName) throw new Error("Plugin folder and manifest names must match");
  if (!STRICT_SEMVER.test(manifest.version)) throw new Error("Plugin version must be a strict semantic version");
  if (manifest.skills !== "./skills/") throw new Error("Plugin skills path must be ./skills/");
  for (const field of ["homepage", "repository"]) {
    if (manifest[field] && !manifest[field].startsWith("https://")) {
      throw new Error(`Plugin ${field} must use https://`);
    }
  }
}

async function validateSkills(pluginRoot) {
  const skillsRoot = path.join(pluginRoot, "skills");
  const skills = (await readdir(skillsRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory());
  if (skills.length === 0) throw new Error("Generated plugin must contain at least one skill");
  for (const skill of skills) {
    const skillFile = path.join(skillsRoot, skill.name, "SKILL.md");
    if (!(await lstat(skillFile)).isFile()) throw new Error(`Skill is missing SKILL.md: ${skill.name}`);
  }
  return skills;
}

async function validateCodexPlugin(marketplaceRoot, pluginName) {
  const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
  const manifest = await readJson(path.join(pluginRoot, ".codex-plugin", "plugin.json"));
  requireCommonManifestFields(manifest, pluginName);
  requireText(manifest.interface?.displayName, "interface.displayName");
  requireText(manifest.interface?.shortDescription, "interface.shortDescription");
  requireText(manifest.interface?.longDescription, "interface.longDescription");
  requireText(manifest.interface?.developerName, "interface.developerName");
  requireText(manifest.interface?.category, "interface.category");
  if (manifest.interface.websiteURL && !manifest.interface.websiteURL.startsWith("https://")) {
    throw new Error("Plugin websiteURL must use https://");
  }
  if ((manifest.interface.defaultPrompt || []).length > 3) throw new Error("Plugin defaultPrompt supports at most three entries");
  if ((manifest.interface.defaultPrompt || []).some((prompt) => prompt.length > 128)) {
    throw new Error("Plugin defaultPrompt entries must be at most 128 characters");
  }

  const skills = await validateSkills(pluginRoot);

  const marketplace = await readJson(path.join(marketplaceRoot, ".agents", "plugins", "marketplace.json"));
  const entry = marketplace.plugins?.find((plugin) => plugin.name === pluginName);
  if (!entry) throw new Error(`Marketplace is missing plugin entry: ${pluginName}`);
  if (entry.source?.source !== "local" || entry.source?.path !== `./plugins/${pluginName}`) {
    throw new Error("Invalid marketplace source path for generated plugin");
  }
  if (entry.policy?.installation !== "AVAILABLE" || entry.policy?.authentication !== "ON_INSTALL") {
    throw new Error("Invalid marketplace policy for generated plugin");
  }

  return { valid: true, pluginName, version: manifest.version, skillCount: skills.length };
}

async function validateClaudePlugin(marketplaceRoot, pluginName) {
  const pluginRoot = path.join(marketplaceRoot, "plugins", pluginName);
  const manifest = await readJson(path.join(pluginRoot, ".claude-plugin", "plugin.json"));
  requireCommonManifestFields(manifest, pluginName);

  const skills = await validateSkills(pluginRoot);

  const marketplace = await readJson(path.join(marketplaceRoot, ".claude-plugin", "marketplace.json"));
  const entry = marketplace.plugins?.find((plugin) => plugin.name === pluginName);
  if (!entry) throw new Error(`Marketplace is missing plugin entry: ${pluginName}`);
  if (entry.source !== `./plugins/${pluginName}`) {
    throw new Error("Invalid marketplace source path for generated plugin");
  }

  return { valid: true, pluginName, version: manifest.version, skillCount: skills.length };
}

export async function validateGeneratedPlugin(marketplaceRoot, pluginName, targetId = "codex") {
  const target = resolveTarget(targetId);
  if (target.id === "claude") return validateClaudePlugin(marketplaceRoot, pluginName);
  return validateCodexPlugin(marketplaceRoot, pluginName);
}
