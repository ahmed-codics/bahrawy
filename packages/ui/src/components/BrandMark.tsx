import { BookOpenCheck } from 'lucide-react';
import { cn } from '../utils';

export function BrandMark({
  compact = false,
  className,
  admin = false,
}: {
  compact?: boolean;
  className?: string;
  admin?: boolean;
}) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-brand-500 text-white dark:bg-brand-400 dark:text-brand-950">
        <BookOpenCheck className="size-6" strokeWidth={2.25} />
        <span className="absolute -bottom-1 -start-1 size-3 rounded-full border-2 border-surface bg-success" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block font-heading text-base font-bold leading-tight text-ink">
            أكاديمية البحراوي
          </span>
          <span
            dir="ltr"
            lang="en"
            className="block text-[0.65rem] font-semibold tracking-[0.13em] text-ink-3"
          >
            {admin ? 'STAFF COMMAND CENTER' : 'LEARN • PRACTICE • MASTER'}
          </span>
        </span>
      )}
    </div>
  );
}
