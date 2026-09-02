import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

const CURSOR_MANIFEST = path.join(".cursor-plugin", "plugin.json");

async function isDirectory(candidate) {
  try {
    return (await lstat(candidate)).isDirectory();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function readManifest(pluginRoot) {
  const manifestDirectory = path.join(pluginRoot, ".cursor-plugin");
  const manifestPath = path.join(pluginRoot, CURSOR_MANIFEST);
  let contents;
  try {
    const directoryMetadata = await lstat(manifestDirectory);
    const manifestMetadata = await lstat(manifestPath);
    if (directoryMetadata.isSymbolicLink() || manifestMetadata.isSymbolicLink()) {
      throw new Error(`Cursor manifest must not use symlinks: ${manifestPath}`);
    }
    contents = await readFile(manifestPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(`Invalid JSON in ${manifestPath}: ${error.message}`);
  }
}

async function canonicalizeProspectivePath(targetPath) {
  let existingAncestor = path.resolve(targetPath);
  const missingSegments = [];
  while (true) {
    try {
      return path.join(await realpath(existingAncestor), ...missingSegments);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      const parent = path.dirname(existingAncestor);
      if (parent === existingAncestor) throw error;
      missingSegments.unshift(path.basename(existingAncestor));
      existingAncestor = parent;
    }
  }
}

export async function discoverSource(inputPath) {
  const input = path.resolve(inputPath);
  const candidates = [input, path.join(input, "pstack")];

  for (const candidate of candidates) {
    const manifest = await readManifest(candidate);
    if (!manifest) continue;
    if (manifest.name !== "pstack") {
      throw new Error(`Expected plugin name \"pstack\" in ${path.join(candidate, CURSOR_MANIFEST)}`);
    }
    if (typeof manifest.version !== "string" || !manifest.version) {
      throw new Error("Cursor pstack manifest must include a version");
    }
    const skillsPath = path.join(candidate, "skills");
    if (!(await isDirectory(skillsPath))) {
      throw new Error(`Cursor pstack skills directory is missing: ${skillsPath}`);
    }

    return {
      root: await realpath(candidate),
      manifest,
      manifestPath: path.join(candidate, CURSOR_MANIFEST),
      skillsPath: await realpath(skillsPath),
    };
  }

  throw new Error(`Could not find a Cursor pstack plugin at ${input}`);
}

export async function assertSafeDestination(sourceRoot, destinationPath) {
  const source = await realpath(sourceRoot);
  const destination = await canonicalizeProspectivePath(destinationPath);
  if (destination === path.parse(destination).root) {
    throw new Error("Filesystem root cannot be used as a destination");
  }
  const relative = path.relative(source, destination);

  if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..")) {
    throw new Error("Destination must be outside the source directory");
  }

  return destination;
}
