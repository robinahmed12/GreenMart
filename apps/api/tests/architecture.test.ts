import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { importsExpressTypes, isExpressImport, isPrismaImport } from "../src/lib/is-prisma-import.js";

const SRC_ROOT = path.resolve(import.meta.dirname, "..", "src");

async function collectTypeScriptFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir);
  const files: string[] = [];

  for (const entry of entries) {
    const full = path.join(dir, entry);
    const info = await stat(full);

    if (info.isDirectory()) {
      files.push(...(await collectTypeScriptFiles(full)));
    } else if (entry.endsWith(".ts")) {
      files.push(full);
    }
  }

  return files;
}

const COMPOSITION_ROOTS = ["app.ts", "server.ts", "container.ts"];

function isRepositoryLocation(relative: string): boolean {
  const segments = relative.split("/");

  if (segments.includes("prisma")) {
    return true;
  }

  if (segments.length === 1 && COMPOSITION_ROOTS.includes(segments[0] ?? "")) {
    return true;
  }

  const moduleIndex = segments.indexOf("modules");
  if (moduleIndex === -1) {
    return false;
  }

  const file = segments[segments.length - 1] ?? "";

  return segments[moduleIndex + 2] === "repositories" || segments[moduleIndex + 2] === "repository" || /(^|[./])repository\.[a-z]+$/.test(file) || /(^|[./])repositorys?\//.test(file);
}

async function findOffendingFiles(root: string): Promise<string[]> {
  const offending: string[] = [];

  for (const file of await collectTypeScriptFiles(root)) {
    const relative = path.relative(SRC_ROOT, file).split(path.sep).join("/");
    if (isRepositoryLocation(relative)) {
      continue;
    }

    if (isPrismaImport(await readFile(file, "utf8"))) {
      offending.push(relative);
    }
  }

  return offending;
}

async function findFilesMatching(root: string, predicate: (source: string) => boolean): Promise<string[]> {
  const matches: string[] = [];

  for (const file of await collectTypeScriptFiles(root)) {
    const relative = path.relative(SRC_ROOT, file).split(path.sep).join("/");
    if (predicate(await readFile(file, "utf8"))) {
      matches.push(relative);
    }
  }

  return matches;
}

function isServiceLocation(relative: string): boolean {
  return relative.endsWith(".service.ts");
}

describe("architecture: Prisma is confined to repository modules", () => {
  it("has no Prisma client import outside a repository or prisma directory", async () => {
    expect(await findOffendingFiles(SRC_ROOT)).toEqual([]);
  });

  it("recognises a Prisma client import in any module", () => {
    expect(isPrismaImport('import { PrismaClient } from "@prisma/client";')).toBe(true);
    expect(isPrismaImport('const { PrismaClient } = require("@prisma/client");')).toBe(true);
    expect(isPrismaImport('import type { Product } from "@prisma/client";')).toBe(true);
  });

  it("ignores imports of packages merely named after prisma", () => {
    expect(isPrismaImport('import { prisma } from "../lib/prisma-helper.js";')).toBe(false);
    expect(isPrismaImport('import express from "express";')).toBe(false);
  });

  it("allows repository locations and rejects service and controller locations", () => {
    expect(isRepositoryLocation("app.ts")).toBe(true);
    expect(isRepositoryLocation("server.ts")).toBe(true);
    expect(isRepositoryLocation("modules/product/product.repository.ts")).toBe(true);
    expect(isRepositoryLocation("modules/product/repositories/product.repository.ts")).toBe(true);
    expect(isRepositoryLocation("prisma/client.ts")).toBe(true);

    expect(isRepositoryLocation("modules/product/product.service.ts")).toBe(false);
    expect(isRepositoryLocation("modules/product/product.controller.ts")).toBe(false);
    expect(isRepositoryLocation("modules/category/category.service.ts")).toBe(false);
    expect(isRepositoryLocation("modules/product/product.route.ts")).toBe(false);
    expect(isRepositoryLocation("lib/text.ts")).toBe(false);
  });

  it("keeps Prisma out of every service module", async () => {
    const services = await collectTypeScriptFiles(SRC_ROOT);
    const offenders: string[] = [];

    for (const file of services) {
      const relative = path.relative(SRC_ROOT, file).split(path.sep).join("/");
      if (isServiceLocation(relative) && isPrismaImport(await readFile(file, "utf8"))) {
        offenders.push(relative);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps Express out of every service module", async () => {
    const offenders = (await findFilesMatching(SRC_ROOT, isExpressImport)).filter(isServiceLocation);

    expect(offenders).toEqual([]);
  });

  it("detects an Express type import in a service", async () => {
    expect(importsExpressTypes('import type { Request, Response } from "express";')).toBe(true);
    expect(importsExpressTypes('import type {Request} from "express";')).toBe(true);
    expect(importsExpressTypes('import { Router } from "express";')).toBe(false);
    expect(importsExpressTypes('import { z } from "zod";')).toBe(false);
  });
});