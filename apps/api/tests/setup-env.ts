import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

for (const candidate of [path.resolve(here, "..", "..", "..", ".env"), path.resolve(here, "..", "..", ".env")]) {
  if (existsSync(candidate)) {
    loadEnv({ path: candidate });
    break;
  }
}