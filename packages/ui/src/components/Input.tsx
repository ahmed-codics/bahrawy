import React, { forwardRef, useId } from 'react';
import { AlertCircle } from 'lucide-react';
import { cn } from '../utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  containerClassName?: string;
  directionMode?: 'auto' | 'ltr' | 'rtl';
  leadingIcon?: React.ReactNode;
  sizeMode?: 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      containerClassName,
      label,
      hint,
      error,
      id,
      directionMode = 'auto',
      leadingIcon,
      type,
      disabled,
      required,
      readOnly,
      sizeMode = 'md',
      ...props
    },
    ref,
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    const isLtr = type === 'email' || type === 'tel' || type === 'url' || directionMode === 'ltr';

    return (
      <div className={cn('flex flex-col', containerClassName)}>
        {label && (
          <label htmlFor={inputId} className="mb-1.5 text-sm font-medium text-ink-2">
            {label}
            {required && (
              <span className="ms-1 text-danger" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div className="relative">
          {leadingIcon && (
            <span
              className="pointer-events-none absolute inset-y-0 start-0 flex w-10 items-center justify-center text-ink-4"
              aria-hidden="true"
            >
              {leadingIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            type={type}
            disabled={disabled}
            readOnly={readOnly}
            required={required}
            dir={isLtr ? 'ltr' : directionMode === 'rtl' ? 'rtl' : undefined}
            aria-invalid={Boolean(error)}
            aria-describedby={cn(hint && hintId, error && errorId) || undefined}
            className={cn(
              'w-full rounded-[var(--radius-md)] border border-border bg-surface px-3 text-base text-ink outline-none transition-[border-color,box-shadow,background-color] duration-[var(--duration-fast)] placeholder:text-ink-4 focus:border-brand-500 focus:shadow-[0_0_0_3px_rgb(37_99_235/0.14)] disabled:cursor-not-allowed disabled:bg-surface-3 disabled:opacity-60 read-only:bg-surface-2 sm:text-sm',
              sizeMode === 'lg' ? 'h-12' : 'h-12',
              leadingIcon && 'ps-10',
              isLtr && 'text-left font-latin',
              error &&
                'border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgb(220_38_38/0.10)]',
              className,
            )}
            {...props}
          />
        </div>
        {hint && (
          <p id={hintId} className="mt-1.5 text-xs text-ink-3">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="mt-1.5 flex items-center gap-1.5 text-xs text-danger">
            <AlertCircle className="size-4" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';
