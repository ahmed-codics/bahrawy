'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react';
import { Button } from './Button';
import { Input } from './Input';

export type SortDirection = 'asc' | 'desc';

export type DataTableColumn<T> = {
  id: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  align?: 'start' | 'center' | 'end';
  sortable?: boolean;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T) => React.Key;
  loading?: boolean;
  error?: string;
  emptyMessage?: string;
  sort?: { columnId: string; direction: SortDirection };
  onSortChange?: (columnId: string, direction: SortDirection) => void;
  page?: number;
  pageCount?: number;
  onPageChange?: (page: number) => void;
  rowActions?: (row: T) => React.ReactNode;
  actionsLabel?: string;
};

const alignmentClasses = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
};

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading = false,
  error,
  emptyMessage = 'لا توجد بيانات',
  sort,
  onSortChange,
  page,
  pageCount,
  onPageChange,
  rowActions,
  actionsLabel = 'الإجراءات',
}: DataTableProps<T>) {
  const displayedColumnCount = columns.length + (rowActions ? 1 : 0);
  const showPagination = page !== undefined && pageCount !== undefined && onPageChange;

  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-border bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-surface-2 text-ink-2">
            <tr>
              {columns.map((column) => {
                const direction = sort?.columnId === column.id ? sort.direction : undefined;
                return (
                  <th
                    key={column.id}
                    scope="col"
                    aria-sort={
                      direction === 'asc'
                        ? 'ascending'
                        : direction === 'desc'
                          ? 'descending'
                          : column.sortable
                            ? 'none'
                            : undefined
                    }
                    className={`whitespace-nowrap px-4 py-3 font-medium ${
                      alignmentClasses[column.align || 'start']
                    }`}
                  >
                    {column.sortable && onSortChange ? (
                      <button
                        type="button"
                        className="ba-focus inline-flex items-center gap-2 rounded-[var(--radius-sm)]"
                        onClick={() =>
                          onSortChange(column.id, direction === 'asc' ? 'desc' : 'asc')
                        }
                      >
                        {column.header}
                        <span aria-hidden="true">{direction === 'desc' ? '↓' : '↑'}</span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th scope="col" className="px-4 py-3 text-end font-medium">
                  {actionsLabel}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading &&
              Array.from({ length: 4 }, (_, rowIndex) => (
                <tr key={`loading-${rowIndex}`} aria-hidden="true">
                  {Array.from({ length: displayedColumnCount }, (_, cellIndex) => (
                    <td key={cellIndex} className="px-4 py-4">
                      <span className="block h-4 animate-pulse rounded-[var(--radius-sm)] bg-surface-3" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && error && (
              <tr>
                <td colSpan={displayedColumnCount} className="px-4 py-10 text-center text-danger">
                  <span className="inline-flex items-center gap-2" role="alert">
                    <AlertCircle className="size-4" aria-hidden="true" />
                    {error}
                  </span>
                </td>
              </tr>
            )}
            {!loading && !error && data.length === 0 && (
              <tr>
                <td colSpan={displayedColumnCount} className="px-4 py-10 text-center text-ink-3">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              data.map((row) => (
                <tr key={keyExtractor(row)} className="hover:bg-surface-2">
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`px-4 py-3 text-ink ${alignmentClasses[column.align || 'start']}`}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                  {rowActions && <td className="px-4 py-3 text-end">{rowActions(row)}</td>}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {showPagination && pageCount > 1 && (
        <div
          className="flex items-center justify-between border-t border-border px-4 py-3"
          aria-label="ترقيم الصفحات"
        >
          <span className="text-xs text-ink-3">
            صفحة {page} من {pageCount}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              aria-label="الصفحة السابقة"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="الصفحة التالية"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FilterBar({
  searchPlaceholder = 'ابحث...',
  searchLabel = 'بحث',
  value,
  onSearch,
  filters,
}: {
  searchPlaceholder?: string;
  searchLabel?: string;
  value?: string;
  onSearch?: (term: string) => void;
  filters?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-y border-border bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <Input
        type="search"
        aria-label={searchLabel}
        containerClassName="w-full sm:max-w-md"
        leadingIcon={<Search className="size-4" />}
        placeholder={searchPlaceholder}
        value={value}
        onChange={(event) => onSearch?.(event.target.value)}
      />
      {filters && (
        <div className="flex w-full items-center gap-2 overflow-x-auto sm:w-auto">{filters}</div>
      )}
    </div>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] || panel)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panel) return;

      const elements = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (!elements.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <m.div
              key="drawer-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px]"
              aria-label="إغلاق اللوحة"
              onClick={onClose}
            />
            <m.div
              key="drawer-panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-xl)] outline-none sm:max-h-[calc(100dvh-3rem)]"
            >
              <div className="flex min-h-16 shrink-0 items-center justify-between border-b border-border bg-surface-2/70 px-5 sm:px-6">
                <h2 id={titleId} className="font-heading text-xl font-bold text-ink">
                  {title}
                </h2>
                <Button variant="ghost" size="icon" aria-label="إغلاق" onClick={onClose}>
                  <X className="size-5" aria-hidden="true" />
                </Button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
                {children}
              </div>
              {footer && (
                <div className="shrink-0 border-t border-border bg-surface-2 p-4 sm:px-6">{footer}</div>
              )}
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>,
    document.body,
  );
}
