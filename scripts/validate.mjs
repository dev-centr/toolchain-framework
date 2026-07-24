import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distIndex = join(root, "dist", "index.js");

const { assertAdapterShape, listSchemaFiles, PROTOCOL_BEHAVIORS, schemasDir } =
  await import(pathToFileURL(distIndex).href);

const schemas = listSchemaFiles(root);
if (schemas.length < 5) {
  console.error("Expected at least 5 schemas, got", schemas);
  process.exit(1);
}
console.log("Schemas:", schemas.join(", "));

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
for (const name of schemas) {
  const schema = JSON.parse(readFileSync(join(schemasDir(root), name), "utf8"));
  ajv.addSchema(schema);
}

const adapterValidate = ajv.getSchema(
  "https://devcentr.org/schemas/tcf/adapter.schema.json"
);
if (!adapterValidate) {
  console.error("adapter schema not loaded");
  process.exit(1);
}

const examplesDir = join(root, "examples");
const examples = readdirSync(examplesDir).filter((n) => n.endsWith(".json"));
if (examples.length === 0) {
  console.error("No example adapters in examples/");
  process.exit(1);
}

let failed = 0;
for (const file of examples) {
  const raw = JSON.parse(readFileSync(join(examplesDir, file), "utf8"));
  const shape = assertAdapterShape(raw);
  if (!shape.ok) {
    console.error(`FAIL ${file} (shape): ${shape.errors}`);
    failed++;
    continue;
  }
  if (!adapterValidate(raw)) {
    console.error(
      `FAIL ${file} (schema): ${ajv.errorsText(adapterValidate.errors, { separator: "; " })}`
    );
    failed++;
    continue;
  }
  const missing = PROTOCOL_BEHAVIORS.filter(
    (b) => !shape.adapter.capabilities.includes(b)
  );
  console.log(
    `OK ${file} ecosystem=${shape.adapter.ecosystem} caps=${shape.adapter.capabilities.length}` +
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
