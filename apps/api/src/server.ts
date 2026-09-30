import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { config as loadEnvFile } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { loadConfig } from "./config/index.js";
import { createApp } from "./app.js";

const here = path.dirname(fileURLToPath(import.meta.url));

for (const candidate of [path.resolve(here, "..", "..", ".env"), path.resolve(here, "..", "..", "..", ".env")]) {
  if (existsSync(candidate)) {
    loadEnvFile({ path: candidate });
    break;
  }
}

const config = loadConfig();
const prisma = new PrismaClient();

const app = createApp({ prisma, webOrigin: config.WEB_ORIGIN });

const server = app.listen(config.PORT, () => {
  console.log(`catalog api listening on http://localhost:${config.PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      void prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}