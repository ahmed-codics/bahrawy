'use client';

import React, { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  loadingText?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      loading = false,
      loadingText = 'Loading...',
      leadingIcon,
      trailingIcon,
      type = 'button',
      disabled,
      children,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;
    const reduceMotion = useReducedMotion();

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading || undefined}
        whileHover={isDisabled || reduceMotion ? undefined : { scale: 1.02 }}
        whileTap={isDisabled || reduceMotion ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className={cn(
          'ba-focus inline-flex min-w-0 items-center justify-center border font-medium leading-none transition-[background-color,border-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          {
            'border-brand-500 bg-brand-500 text-white hover:border-brand-600 hover:bg-brand-600 dark:border-brand-400 dark:bg-brand-400 dark:text-brand-950 dark:hover:bg-brand-300':
              variant === 'primary' || variant === 'accent',
            'border-surface-3 bg-surface-3 text-ink hover:border-border-2':
              variant === 'secondary',
            'border-border-2 bg-transparent text-ink hover:bg-surface-3': variant === 'outline',
            'border-transparent bg-transparent text-ink-2 hover:bg-surface-3 hover:text-ink':
              variant === 'ghost',
            'border-danger/10 bg-[var(--color-danger-bg)] text-danger hover:bg-danger/15 dark:bg-danger/10':
              variant === 'danger',
            'min-h-11 gap-1.5 rounded-[var(--radius-md)] px-3 text-sm': size === 'sm',
            'min-h-11 gap-2 rounded-[var(--radius-md)] px-4 text-sm': size === 'md',
            'h-12 gap-2.5 rounded-[var(--radius-md)] px-5 text-base': size === 'lg',
            'aspect-square size-11 rounded-[var(--radius-md)] px-0': size === 'icon',
          },
          className,
        )}
        {...(props as Record<string, unknown>)}
      >
        {loading && <span className="sr-only">{loadingText}</span>}
        {loading ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />
        ) : (
          leadingIcon
        )}
        {size !== 'icon' && (
          <span className="truncate" aria-hidden={loading || undefined}>
            {children}
          </span>
        )}
        {size === 'icon' && !loading && children}
        {!loading && trailingIcon}
      </motion.button>
    );
  },
);
Button.displayName = 'Button';
