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
    "---\nname: poteto-mode\ndescription: rigorous work\ndisable-model-invocation: true\n---\n\nUse `/poteto-mode`. Ask the Agent tool to use claude-opus.\n",
  );
  await mkdir(path.join(pluginRoot, "docs"), { recursive: true });
  await mkdir(path.join(pluginRoot, "scripts"), { recursive: true });
  await mkdir(path.join(pluginRoot, "agents"), { recursive: true });
  await mkdir(path.join(pluginRoot, "automations", "benny"), { recursive: true });
  await writeFile(path.join(pluginRoot, "README.md"), "# pstack\n");
  await writeFile(path.join(pluginRoot, "LICENSE"), "MIT fixture\n");
  await mkdir(path.join(pluginRoot, "skills", "setup-pstack"), { recursive: true });
  await writeFile(
    path.join(pluginRoot, "skills", "setup-pstack", "SKILL.md"),
    "---\nname: setup-pstack\ndescription: configure pstack\ndisable-model-invocation: true\n---\n\nWrite ~/.cursor/rules/pstack.mdc.\n",
  );
  await writeFile(path.join(pluginRoot, "docs", "guide.md"), "Use `/setup-pstack`.\n");
  await writeFile(path.join(pluginRoot, "scripts", "verify.mjs"), "export const ok = true;\n");
  await writeFile(path.join(pluginRoot, "agents", "reviewer.md"), "Cursor reviewer\n");
  await writeFile(path.join(pluginRoot, "automations", "benny", "README.md"), "Cursor automation\n");
  return pluginRoot;
}
