/** Wave 5 · lane E · the pill badge's number, at most 4 characters: 42 · 999 · 1.2k · 12k · 123k. */
export function formatCoins(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n < 1000) return String(Math.floor(n));
  if (n < 10_000) { const k = Math.floor(n / 100) / 10; return `${k % 1 ? k.toFixed(1) : k}k`; }
  return `${Math.floor(n / 1000)}k`;
}
