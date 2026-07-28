import React, { forwardRef } from 'react';
import { AlertTriangle, Inbox, TrendingUp } from 'lucide-react';
import { cn } from '../utils';
import { Button } from './Button';
import { Card, CardContent } from './Card';

export type SemanticTone =
  'neutral' | 'blue' | 'cyan' | 'amber' | 'violet' | 'coral' | 'success' | 'danger';

const badgeTones: Record<SemanticTone, string> = {
  neutral: 'border-border bg-surface-3 text-ink-2',
  blue: 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-200',
  cyan: 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-200',
  amber:
    'border-warning/20 bg-[var(--color-warning-bg)] text-warning dark:bg-warning/10',
  violet:
    'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-800 dark:bg-brand-950/30 dark:text-brand-200',
  coral:
    'border-danger/20 bg-[var(--color-danger-bg)] text-danger dark:bg-danger/10',
  success: 'border-success/20 bg-[var(--color-success-bg)] text-success dark:bg-success/10',
  danger: 'border-danger/20 bg-[var(--color-danger-bg)] text-danger dark:bg-danger/10',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: SemanticTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium leading-normal whitespace-normal',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ProgressBar({
  value,
  label,
  className,
  tone = 'blue',
}: {
  value: number;
  label?: string;
  className?: string;
  tone?: 'cyan' | 'blue' | 'violet' | 'amber';
}) {
  const safeValue = Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0));
  const colors = {
    cyan: 'bg-brand-500',
    blue: 'bg-brand-500',
    violet: 'bg-brand-500',
    amber: 'bg-warning',
  };
  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-bold text-text-muted">{label}</span>
          <span className="ba-number font-semibold text-ink">
            {Math.round(safeValue)}%
          </span>
        </div>
      )}
      <div
        className="h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="progressbar"
        aria-label={label || 'نسبة التقدم'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue)}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-500 ease-out',
            colors[tone],
          )}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('ba-skeleton rounded-xl', className)} aria-hidden="true" />;
}

export function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <div className="space-y-7" aria-label="جاري تحميل المحتوى">
      <div className="space-y-3">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} className="h-52" />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-lg)] border border-dashed border-border bg-surface px-4 py-8 text-center shadow-[var(--shadow-xs)] sm:px-6 sm:py-12',
        className,
      )}
    >
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-[var(--radius-lg)] bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-200">
        {icon || <Inbox className="size-7" />}
      </div>
      <h3 className="font-heading text-xl font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-ink-3">{description}</p>
      )}
      {actionLabel && onAction && (
        <Button className="mt-6 w-full sm:w-auto" variant="outline" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'تعذر تحميل المحتوى',
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <EmptyState
      icon={<AlertTriangle className="size-7 text-danger" />}
      title={title}
      description={description || 'تحقق من اتصالك وحاول مرة أخرى.'}
      actionLabel={onRetry ? 'إعادة المحاولة' : undefined}
      onAction={onRetry}
    />
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        'mb-5 flex min-w-0 flex-col gap-4 border-b border-border pb-5 sm:mb-6 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <span className="ba-kicker mb-3">{eyebrow}</span>}
        <h1 className="break-words font-heading text-[clamp(1.5rem,7vw,2rem)] font-bold leading-[1.3] text-ink">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-ink-3">{description}</p>
        )}
      </div>
      {actions && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">{actions}</div>}
    </header>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'blue',
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: 'blue' | 'cyan' | 'amber' | 'violet' | 'coral';
}) {
  const toneClasses = {
    blue: 'bg-brand-50 text-brand-700 dark:bg-brand-950/35 dark:text-brand-200',
    cyan: 'bg-brand-50 text-brand-700 dark:bg-brand-950/35 dark:text-brand-200',
    amber: 'bg-[var(--color-warning-bg)] text-warning dark:bg-warning/10',
    violet: 'bg-brand-50 text-brand-700 dark:bg-brand-950/35 dark:text-brand-200',
    coral: 'bg-[var(--color-danger-bg)] text-danger dark:bg-danger/10',
  };
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 pt-0">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-3">{label}</p>
          <p className="ba-number mt-1 text-3xl font-bold text-ink">{value}</p>
          {hint && (
            <p className="mt-2 flex items-center gap-1 text-xs text-success">
              <TrendingUp className="size-3.5" />
              {hint}
            </p>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)]',
              toneClasses[tone],
            )}
          >
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, id, className, required, ...props }, ref) => {
    const textareaId = id || React.useId();
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={textareaId} className="mb-1.5 text-sm font-medium text-ink-2">
            {label}
            {required && <span className="ms-1 text-danger">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          required={required}
          aria-invalid={Boolean(error)}
          className={cn(
            'min-h-32 w-full resize-y rounded-[var(--radius-md)] border border-border bg-surface px-3 py-3 text-base text-ink outline-none transition duration-200 placeholder:text-ink-4 focus:border-brand-500 focus:shadow-[0_0_0_3px_rgb(37_99_235/0.14)] disabled:opacity-50 sm:text-sm',
            error && 'border-danger',
            className,
          )}
          {...props}
        />
        {error ? (
          <p role="alert" className="text-xs font-bold text-danger">
            {error}
          </p>
        ) : (
          hint && <p className="text-xs text-text-muted">{hint}</p>
        )}
      </div>
    );
  },
);
Textarea.displayName = 'Textarea';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, id, className, children, ...props }, ref) => {
    const selectId = id || React.useId();
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label htmlFor={selectId} className="mb-1.5 text-sm font-medium text-ink-2">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'h-12 min-w-0 rounded-[var(--radius-md)] border border-border bg-surface px-3 py-2 text-base text-ink outline-none transition duration-200 focus:border-brand-500 focus:shadow-[0_0_0_3px_rgb(37_99_235/0.14)] disabled:opacity-50 sm:text-sm',
            className,
          )}
          {...props}
        >
          {children}
        </select>
        {hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
    );
  },
);
Select.displayName = 'Select';
