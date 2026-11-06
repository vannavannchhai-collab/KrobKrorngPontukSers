import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Minimal `.env` loader (no dependency).
 *
 * Imported first by the server entrypoint so `GOOGLE_CLIENT_ID`,
 * `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `JWT_SECRET`, `PORT`, `DB_PATH`
 * can be configured by creating a `.env` file in the project root.
 * Real environment variables always win over the file.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const name of [".env", ".env.local"]) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) continue;
  let raw: string;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
