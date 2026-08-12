'use client';

import type { ReactNode } from 'react';

export type PriceLike = {
  amount?: number | string | null;
  originalAmount?: number | string | null;
  currency?: string;
};

export function moneyOf(
  value: number | string | null | undefined,
): string | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('ar-EG') : String(value);
}

export function discountPercent(price?: PriceLike | null): number | null {
  if (!price) return null;
  const final = Number(price.amount);
  const original = Number(price.originalAmount);
  if (!Number.isFinite(final) || !Number.isFinite(original)) return null;
  if (final <= 0 || original <= 0) return null;
  if (original <= final) return null;
  return Math.round((1 - final / original) * 100);
}

export function PriceTag({
  price,
  finalClassName,
  originalClassName,
}: {
  price?: PriceLike | null;
  finalClassName?: string;
  originalClassName?: string;
}): ReactNode {
  if (!price) return <span className="text-text-muted">—</span>;
  const final = Number(price.amount);
  if (final === 0) return <span>مجاني</span>;
  const currency = price.currency || 'EGP';
  const finalMoney = `${moneyOf(final)} ${currency}`;
  const percent = discountPercent(price);
  if (percent === null) {
    return <span className={finalClassName}>{finalMoney}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <s className={originalClassName ?? 'text-sm font-semibold text-text-muted line-through'}>
        {moneyOf(Number(price.originalAmount))} {currency}
      </s>
      <span className={finalClassName}>{finalMoney}</span>
      <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-black text-danger">
        {percent}% OFF
      </span>
    </span>
  );
}