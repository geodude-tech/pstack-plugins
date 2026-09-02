import { lstat, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { convertPstack } from "./conversion.js";
import { assertSafeDestination, discoverSource } from "./discovery.js";

export const USAGE = `Usage: pstack-to-codex <source> --out <destination> [options]

Options:
  --name <name>  Override the generated plugin name
  --force        Replace an existing converter-owned destination
  --dry-run      Analyze without creating the destination
  --json         Print machine-readable output
  --help         Show this help
`;

export function parseArgs(argv) {
  if (argv.includes("--help")) return { help: true };
  const options = { force: false, dryRun: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("-")) {
      if (options.sourcePath) throw new Error(`Unexpected argument: ${argument}`);
      options.sourcePath = argument;
    } else if (argument === "--force") options.force = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--json") options.json = true;
    else if (argument === "--out" || argument === "--name") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) throw new Error(`${argument} requires a value`);
      options[argument === "--out" ? "destination" : "name"] = value;
      index += 1;
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (!options.sourcePath) throw new Error("A source path is required");
  if (!options.destination) throw new Error("--out is required");
  return options;
}

async function assertOwnedDestination(destination) {
  const metadata = await lstat(destination);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Destination is not owned by pstack-to-codex: ${destination}`);
  }
  try {
    const receipt = JSON.parse(await readFile(path.join(destination, ".pstack-to-codex.json"), "utf8"));
    if (receipt.generator !== "pstack-to-codex") throw new Error("receipt mismatch");
  } catch {
    throw new Error(`Destination is not owned by pstack-to-codex: ${destination}`);
  }
}

async function destinationExists(destination) {
  try {
    await lstat(destination);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function printableResult(result, requestedDestination, dryRun) {
  const pluginRoot = path.join(path.resolve(requestedDestination), "plugins", result.pluginName);
  return {
    dryRun,
    destination: path.resolve(requestedDestination),
    pluginName: result.pluginName,
    pluginRoot,
    receipt: { ...result.receipt, generatedAt: dryRun ? null : result.receipt.generatedAt },
    compatibility: result.compatibility,
  };
}

export async function runCli(argv, io = process) {
  let temporaryRoot;
  let preserveTemporaryRoot = false;
  try {
    const options = parseArgs(argv);
    if (options.help) {
      io.stdout.write(USAGE);
      return 0;
    }

    const source = await discoverSource(options.sourcePath);
    const destination = await assertSafeDestination(source.root, options.destination);
    const hadDestination = await destinationExists(destination);
    if (!options.dryRun && hadDestination) {
      if (!options.force) throw new Error(`Destination already exists: ${destination}`);
      await assertOwnedDestination(destination);
    }

    let conversionDestination;
    if (options.dryRun) {
      temporaryRoot = await mkdtemp(path.join(tmpdir(), "pstack-to-codex-preview-"));
    } else {
      await mkdir(path.dirname(destination), { recursive: true });
      temporaryRoot = await mkdtemp(path.join(path.dirname(destination), ".pstack-to-codex-"));
    }
    conversionDestination = path.join(temporaryRoot, "output");
    const result = await convertPstack({
      sourcePath: source.root,
      destination: conversionDestination,
      name: options.name,
    });
    if (!options.dryRun) {
      const previousDestination = path.join(temporaryRoot, "previous");
      if (hadDestination) await rename(destination, previousDestination);
      try {
        await rename(conversionDestination, destination);
      } catch (error) {
        if (hadDestination) {
          try {
            await rename(previousDestination, destination);
          } catch (restoreError) {
            preserveTemporaryRoot = true;
            throw new Error(
              `Failed to replace destination (${error.message}); previous output remains at ${previousDestination} (${restoreError.message})`,
            );
          }
        }
        throw error;
      }
    }
    const output = printableResult(result, destination, options.dryRun);
    if (options.json) io.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    else {
      const verb = options.dryRun ? "Previewed" : "Generated";
      io.stdout.write(`${verb} ${output.pluginName} at ${output.pluginRoot}\n`);
      io.stdout.write(`Manual-review findings: ${output.compatibility.summary.findings}\n`);
      io.stdout.write(`Review ${path.join(output.pluginRoot, "compatibility", "report.md")}\n`);
    }
    return output.compatibility.summary.findings > 0 ? 2 : 0;
  } catch (error) {
    io.stderr.write(`pstack-to-codex: ${error.message}\n`);
    return 1;
  } finally {
    if (temporaryRoot && !preserveTemporaryRoot) {
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  }
}
