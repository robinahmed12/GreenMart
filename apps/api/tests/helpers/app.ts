import { PrismaClient } from "@prisma/client";
import { createApp } from "../../src/app.js";

export const prisma = new PrismaClient();

export function buildTestApp() {
  return createApp({ prisma, webOrigin: "http://localhost:3000" });
}