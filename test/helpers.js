import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export async function createCursorPstack(root, options = {}) {
  const pluginRoot = options.asRepository ? path.join(root, "pstack") : root;
  await mkdir(path.join(pluginRoot, ".cursor-plugin"), { recursive: true });
  await mkdir(path.join(pluginRoot, "skills", "poteto-mode"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, ".cursor-plugin", "plugin.json"),
    JSON.stringify({
      name: "pstack",
      displayName: "pstack",
      version: "0.14.6",
      description: "rigorous agent workflows",
      author: { name: "Lauren Tan" },
      homepage: "https://github.com/cursor/plugins/tree/main/pstack",
      repository: "https://github.com/cursor/plugins",
      license: "MIT",
      keywords: ["pstack", "workflow"],
      skills: "./skills/",
      agents: "./agents/",
    }, null, 2),
  );
  await writeFile(
    path.join(pluginRoot, "skills", "poteto-mode", "SKILL.md"),
    "---\nname: poteto-mode\ndescription: rigorous work\n---\n\nUse `/poteto-mode`.\n",
  );
  return pluginRoot;
}
