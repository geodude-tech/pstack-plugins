import { execFile } from "node:child_process";
import { copyFile, lstat, mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { assertSafeDestination, discoverSource } from "./discovery.js";
import { createMarketplace, createPluginManifest, normalizePluginName } from "./manifest.js";

const execFileAsync = promisify(execFile);
const COPY_DIRECTORIES = ["skills", "docs", "scripts", "assets"];
const COPY_FILES = ["README.md", "LICENSE", "NOTICE"];
const OMIT_DIRECTORIES = ["agents", "automations", "hooks"];

async function pathExists(candidate) {
  try {
    await lstat(candidate);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function copyTree(source, destination, sourceRoot, copiedFiles) {
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
      );
    }
    return;
  }
  if (!metadata.isFile()) {
    throw new Error(`Unsupported filesystem entry in source: ${source}`);
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

export async function convertPstack(options) {
  const source = await discoverSource(options.sourcePath);
  const destination = await assertSafeDestination(source.root, options.destination);
  if (await pathExists(destination)) {
    throw new Error(`Destination already exists: ${destination}`);
  }

  const pluginName = normalizePluginName(options.name || "pstack-for-codex");
  const pluginRoot = path.join(destination, "plugins", pluginName);
  const copiedFiles = [];
  const omittedPaths = [];

  for (const directory of COPY_DIRECTORIES) {
    const sourcePath = path.join(source.root, directory);
    if (await pathExists(sourcePath)) {
      await copyTree(sourcePath, path.join(pluginRoot, directory), source.root, copiedFiles);
    }
  }
  for (const filename of COPY_FILES) {
    const sourcePath = path.join(source.root, filename);
    if (await pathExists(sourcePath)) {
      await copyTree(sourcePath, path.join(pluginRoot, filename), source.root, copiedFiles);
    }
  }
  for (const directory of OMIT_DIRECTORIES) {
    if (await pathExists(path.join(source.root, directory))) omittedPaths.push(directory);
  }

  const pluginManifest = createPluginManifest(source.manifest, pluginName);
  await writeJson(path.join(pluginRoot, ".codex-plugin", "plugin.json"), pluginManifest);
  await writeJson(
    path.join(destination, ".agents", "plugins", "marketplace.json"),
    createMarketplace(pluginName),
  );

  const receipt = {
    generator: "pstack-to-codex",
    generatedAt: new Date().toISOString(),
    plugin: { name: pluginName, version: pluginManifest.version },
    source: {
      path: source.root,
      version: source.manifest.version,
      commit: await readGitCommit(source.root),
    },
    copiedFiles: copiedFiles.sort(),
    omittedPaths: omittedPaths.sort(),
  };
  await writeJson(path.join(destination, ".pstack-to-codex.json"), receipt);

  return { destination, pluginName, pluginRoot, receipt };
}
