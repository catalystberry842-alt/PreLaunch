import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fileValues = new Map<string, string>();
let filesLoaded = false;

function stripQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadServerDotenv() {
  if (filesLoaded) return;
  filesLoaded = true;
  if (typeof window !== "undefined") return;

  const files = [
    resolve(process.cwd(), ".env.local"),
    resolve(process.cwd(), ".env"),
    "/workspace/.env.local",
  ];

  for (const file of files) {
    let text = "";
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq <= 0) continue;
      const key = line.slice(0, eq).trim();
      if (!key || key.startsWith("VITE_")) continue;
      const value = stripQuotes(line.slice(eq + 1).trim());
      if (!value || fileValues.has(key)) continue;
      fileValues.set(key, value);
    }
  }
}

export function env(key: string): string | undefined {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess) return fromProcess;
  loadServerDotenv();
  const fromFile = fileValues.get(key)?.trim();
  return fromFile || undefined;
}

/**
 * Workspace preview vs deployed app. The deployer writes GROK_PROJECT_ID on
 * every publish; the sandbox preview never has it. Single source of truth for
 * the split — gate audience, gate endpoints and connector-token semantics all
 * key off this predicate.
 */
export function isWorkspacePreview(): boolean {
  return !env("GROK_PROJECT_ID");
}
