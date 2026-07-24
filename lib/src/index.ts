import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const PROTOCOL_BEHAVIORS = [
  "bootstrap",
  "pin-resolve",
  "health",
  "repair",
  "upgrade-rollback",
  "surface-parity",
] as const;

export type ProtocolBehavior = (typeof PROTOCOL_BEHAVIORS)[number];

export interface AdapterStub {
  ecosystem: string;
  displayName?: string;
  protocolVersion: number;
  entrypoint?: string;
  capabilities: ProtocolBehavior[];
  communityBridges?: string[];
  notes?: string;
}

export function schemasDir(root = join(__dirname, "..")): string {
  return join(root, "schemas");
}

export function createValidator(root?: string) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const dir = schemasDir(root);
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".schema.json")) continue;
    const schema = JSON.parse(readFileSync(join(dir, name), "utf8"));
    ajv.addSchema(schema);
  }
  return ajv;
}

export function validateAdapter(
  adapter: unknown,
  root?: string
): { ok: true; adapter: AdapterStub } | { ok: false; errors: string } {
  const ajv = createValidator(root);
  const validate = ajv.getSchema("https://dev-centr.org/schemas/tcf/adapter-stub.schema.json");
  if (!validate) {
    return { ok: false, errors: "adapter stub schema not registered" };
  }
  if (validate(adapter)) {
    return { ok: true, adapter: adapter as AdapterStub };
  }
  return { ok: false, errors: ajv.errorsText(validate.errors) };
}
