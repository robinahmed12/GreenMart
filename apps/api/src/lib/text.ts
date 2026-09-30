export function tokenize(query: string): string[] {
  return query.split(/\s+/).filter((token) => token.length > 0);
}

export function normalizeToken(token: string): string {
  return token.toLowerCase();
}

export function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number.parseFloat(String(value));
}