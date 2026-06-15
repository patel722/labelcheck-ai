export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeLooseText(value: string): string {
  return normalizeWhitespace(value)
    .normalize("NFKD")
    .replace(/[‘’´`]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase();
}

export function normalizeLabelName(value: string): string {
  return normalizeLooseText(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|brand)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeClassType(value: string): string {
  return normalizeLooseText(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = Array.from({ length: b.length + 1 }, () => 0);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const substitutionCost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + substitutionCost,
      );
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }

  return previous[b.length];
}

export function similarityScore(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshteinDistance(a, b) / longest;
}

export function parseAlcoholContent(value: string): number | null {
  const lower = normalizeLooseText(value);
  const proofMatch = lower.match(/(\d+(?:\.\d+)?)\s*proof\b/);
  if (proofMatch) return Number(proofMatch[1]) / 2;

  const abvMatch =
    lower.match(/(\d+(?:\.\d+)?)\s*%\s*(?:alc(?:ohol)?\.?\s*\/?\s*vol\.?|abv)?/) ??
    lower.match(/(\d+(?:\.\d+)?)\s*(?:abv|alc(?:ohol)?\s*by\s*volume)/);
  if (abvMatch) return Number(abvMatch[1]);

  return null;
}

export function formatAbv(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}% ABV`;
}

export function parseNetContentsMl(value: string): number | null {
  const lower = normalizeLooseText(value);
  const match = lower.match(
    /(\d+(?:\.\d+)?)\s*(milliliters?|millilitres?|ml|liters?|litres?|l|fluid ounces?|fl\.?\s*oz\.?|floz)\b/,
  );
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2].replace(/\s+/g, " ").replace(/\./g, "");
  if (!Number.isFinite(amount)) return null;

  if (["l", "liter", "liters", "litre", "litres"].includes(unit)) {
    return amount * 1000;
  }

  if (["fluid ounce", "fluid ounces", "fl oz", "floz"].includes(unit)) {
    return amount * 29.5735295625;
  }

  return amount;
}

export function formatMl(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} mL`;
}
