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
    <div className={cn('ba-brand flex min-w-0 items-center gap-2.5 sm:gap-3', className)}>
      <span className="relative flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-brand-500 text-white dark:bg-brand-400 dark:text-brand-950">
        <BookOpenCheck className="size-6" strokeWidth={2.25} />
        <span className="absolute -bottom-1 -start-1 size-3 rounded-full border-2 border-surface bg-success" />
      </span>
      {!compact && (
        <span className="ba-brand-copy min-w-0">
          <span
            className="block truncate text-xl font-bold leading-tight text-ink sm:text-2xl"
            style={{ fontFamily: 'var(--font-marhey), sans-serif' }}
          >
            البحراوي
          </span>
          {admin && (
            <span
              dir="ltr"
              lang="en"
              className="ba-brand-tagline block truncate text-[0.58rem] font-semibold tracking-[0.11em] text-ink-3 sm:text-[0.65rem] sm:tracking-[0.13em]"
            >
              STAFF COMMAND CENTER
            </span>
          )}
        </span>
      )}
    </div>
  );
}
