import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const sourceFiles = [
  "js/config.js",
  "js/model.js",
  "js/charts.js",
  "js/ui.js",
  "js/app.js",
];
const outputFile = resolve(projectRoot, "js/app.standalone.js");

function stripModuleSyntax(source) {
  const stripped = [];
  let skippingImport = false;

  for (const line of source.split(/\r?\n/)) {
    if (skippingImport) {
      if (/\bfrom\s+["'][^"']+["'];?\s*$/.test(line)) {
        skippingImport = false;
      }
      continue;
    }

    if (/^\s*import\s+/.test(line)) {
      if (
        /\bfrom\s+["'][^"']+["'];?\s*$/.test(line) ||
        /^\s*import\s+["'][^"']+["'];?\s*$/.test(line)
      ) {
        continue;
      }
      skippingImport = true;
      continue;
    }

    if (/^\s*export\s+default\s+[\w$]+;\s*$/.test(line)) continue;
    stripped.push(line.replace(/^(\s*)export\s+/, "$1"));
  }

  return stripped.join("\n");
}

export async function buildStandalone({ write = false } = {}) {
  const sections = [];

  for (const relativePath of sourceFiles) {
    const source = await readFile(resolve(projectRoot, relativePath), "utf8");
    sections.push(
      `/* ---- ${relativePath} ---- */\n${stripModuleSyntax(source).trim()}`,
    );
  }

  const output = `/*
 * Generated file for direct file:// use in Edge and other browsers.
 * Source of truth: js/config.js, js/model.js, js/charts.js, js/ui.js, js/app.js.
 * Rebuild with: node scripts/build-standalone.mjs
 */
(() => {
  "use strict";

  if (window.location.protocol !== "file:") return;

${sections.join("\n\n")}
})();
`;

  if (/^\s*(?:import|export)\s/m.test(output)) {
    throw new Error("Generated standalone bundle still contains module syntax.");
  }

  if (write) {
    await writeFile(outputFile, output, "utf8");
  }

  return output;
}

const isDirectRun =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isDirectRun) {
  await buildStandalone({ write: true });
  process.stdout.write("Generated js/app.standalone.js\n");
}
