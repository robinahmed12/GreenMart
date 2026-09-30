import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { openApiDocument } from "./openapi.js";

const target = path.resolve(import.meta.dirname, "..", "openapi.json");

await mkdir(path.dirname(target), { recursive: true });
await writeFile(target, `${JSON.stringify(openApiDocument, null, 2)}\n`, "utf8");

console.log(`wrote ${target}`);