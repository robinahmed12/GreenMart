export function isPrismaImport(source: string): boolean {
  return /from\s+["']@prisma\/client["']/.test(source) || /require\(["']@prisma\/client["']\)/.test(source);
}

export function isExpressImport(source: string): boolean {
  return /from\s+["']express["']/.test(source) || /require\(["']express["']\)/.test(source);
}

export function importsExpressTypes(source: string): boolean {
  return /import\s+type\s*\{[^}]*\}\s*from\s*["']express["']/.test(source);
}