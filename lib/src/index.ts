import { readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

/** Package root when this module is loaded from `dist/`. */
export function packageRoot(): string {
  return join(__dirname, "..");
}

export function schemasDir(root = packageRoot()): string {
  return join(root, "schemas");
}

export function listSchemaFiles(root = packageRoot()): string[] {
  return readdirSync(schemasDir(root)).filter((n) =>
    n.endsWith(".schema.json")
  );
}

/** Structural check without AJV (AJV used in scripts/validate.mjs for full schema). */
export function assertAdapterShape(
  value: unknown
): { ok: true; adapter: AdapterStub } | { ok: false; errors: string } {
  if (value === null || typeof value !== "object") {
    return { ok: false, errors: "adapter must be an object" };
  }
  const a = value as Record<string, unknown>;
  if (typeof a.ecosystem !== "string" || !a.ecosystem) {
    return { ok: false, errors: "ecosystem required string" };
  }
  if (typeof a.protocolVersion !== "number" || a.protocolVersion < 1) {
    return { ok: false, errors: "protocolVersion must be integer >= 1" };
  }
  if (!Array.isArray(a.capabilities) || a.capabilities.length < 1) {
    return { ok: false, errors: "capabilities must be non-empty array" };
  }
  for (const c of a.capabilities) {
    if (!PROTOCOL_BEHAVIORS.includes(c as ProtocolBehavior)) {
      return { ok: false, errors: `unknown capability: ${String(c)}` };
    }
  }
  return { ok: true, adapter: a as unknown as AdapterStub };
}
