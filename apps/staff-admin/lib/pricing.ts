export function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function discountPercent(
  finalAmount: number | string | null | undefined,
  originalAmount: number | string | null | undefined,
): number | null {
  const final = toNumber(finalAmount);
  const original = toNumber(originalAmount);
  if (final === null || original === null) return null;
  if (final < 0 || original < 0) return null;
  if (original <= final) return null;
  return Math.round((1 - final / original) * 100);
}

export function discountLabel(
  finalAmount: number | string | null | undefined,
  originalAmount: number | string | null | undefined,
): string | null {
  const percent = discountPercent(finalAmount, originalAmount);
  return percent === null ? null : `خصم ${percent}%`;
}