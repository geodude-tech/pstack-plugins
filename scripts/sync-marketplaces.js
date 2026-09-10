import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
for (const manifestPath of [".agents/plugins/marketplace.json", ".claude-plugin/marketplace.json"]) {
  const marketplace = JSON.parse(await readFile(path.join(root, "generated", manifestPath), "utf8"));
  for (const plugin of marketplace.plugins) {
    if (typeof plugin.source === "string") {
      plugin.source = `./generated/${plugin.source.replace(/^\.\//, "")}`;
    } else {
      plugin.source.path = `./generated/${plugin.source.path.replace(/^\.\//, "")}`;
    }
  }
  const destination = path.join(root, manifestPath);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(marketplace, null, 2)}\n`);
}
