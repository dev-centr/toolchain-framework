import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distIndex = join(root, "dist", "index.js");

const { validateAdapter, listSchemaFiles, PROTOCOL_BEHAVIORS } = await import(
  pathToFileURL(distIndex).href
);

const schemas = listSchemaFiles(root);
if (schemas.length < 5) {
  console.error("Expected at least 5 schemas, got", schemas);
  process.exit(1);
}
console.log("Schemas:", schemas.join(", "));

const examplesDir = join(root, "examples");
const examples = readdirSync(examplesDir).filter((n) => n.endsWith(".json"));
if (examples.length === 0) {
  console.error("No example adapters in examples/");
  process.exit(1);
}

let failed = 0;
for (const file of examples) {
  const raw = JSON.parse(readFileSync(join(examplesDir, file), "utf8"));
  const result = validateAdapter(raw, root);
  if (!result.ok) {
    console.error(`FAIL ${file}: ${result.errors}`);
    failed++;
    continue;
  }
  const missing = PROTOCOL_BEHAVIORS.filter(
    (b) => !result.adapter.capabilities.includes(b)
  );
  console.log(
    `OK ${file} ecosystem=${result.adapter.ecosystem} caps=${result.adapter.capabilities.length}` +
      (missing.length ? ` (partial; missing: ${missing.join(", ")})` : "")
  );
}

const protocolSdl = readFileSync(join(root, "contracts", "protocol.sdl"), "utf8");
for (const b of PROTOCOL_BEHAVIORS) {
  if (!protocolSdl.includes(`id "${b}"`)) {
    console.error(`protocol.sdl missing behavior id "${b}"`);
    failed++;
  }
}

if (failed) {
  process.exit(1);
}
console.log("validate: OK");
