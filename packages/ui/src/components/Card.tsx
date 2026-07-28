import React, { forwardRef } from 'react';
import { cn } from '../utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  as?: React.ElementType;
  interactive?: boolean;
  tone?: 'default' | 'blue' | 'cyan' | 'amber' | 'violet' | 'coral';
}

const tones = {
  default: 'border-border bg-surface',
  blue: 'border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/25',
  cyan: 'border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/25',
  amber: 'border-warning/20 bg-[var(--color-warning-bg)] dark:bg-warning/10',
  violet: 'border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950/25',
  coral: 'border-danger/20 bg-[var(--color-danger-bg)] dark:bg-danger/10',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, as: Component = 'div', interactive = false, tone = 'default', ...props }, ref) => (
    <Component
      ref={ref as unknown as React.LegacyRef<HTMLDivElement>}
      className={cn(
        'min-w-0 rounded-[var(--radius-card)] border p-4 text-ink shadow-[var(--shadow-xs)] sm:p-6',
        tones[tone],
        interactive &&
          'cursor-pointer transition-[border-color,box-shadow] duration-[var(--duration-base)] ease-[var(--ease-out)] hover:border-border-2 hover:shadow-[var(--shadow-md)]',
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('border-b border-border pb-4', className)}
      {...props}
    />
  ),
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement> & { as?: React.ElementType }
>(({ className, as: Component = 'h3', ...props }, ref) => (
  <Component
    ref={ref as unknown as React.LegacyRef<HTMLHeadingElement>}
    className={cn('font-heading text-xl font-semibold leading-tight text-ink', className)}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('mt-1 text-sm text-ink-3', className)} {...props} />
));
CardDescription.displayName = 'CardDescription';

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('pt-4', className)} {...props} />
  ),
);
CardContent.displayName = 'CardContent';

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('mt-4 flex items-center gap-3 border-t border-border pt-4', className)}
      {...props}
    />
  ),
);
CardFooter.displayName = 'CardFooter';
