'use client';

import React, { type ReactNode, useState } from 'react';
import { Bell, LogOut, Menu, Plus, X } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { cn } from '../utils';
import { BrandMark } from './BrandMark';
import { Button } from './Button';
import { DataSaverToggle } from './DataSaverToggle';
import { ThemeSelector } from './ThemeSelector';
import { Badge } from './Primitives';

export interface NavigationItem {
  icon?: ReactNode;
  label: string;
  href: string;
  isActive?: boolean;
  badge?: string | number;
}

export interface ShellUser {
  name: string;
  role: string;
  avatarUrl?: string;
}

interface BaseShellProps {
  children: ReactNode;
  user?: ShellUser;
  navigation: NavigationItem[];
  onNavigate?: (href: string) => void;
  onLogout?: () => void;
  brandName?: string;
}

function Avatar({ user, size = 'md' }: { user?: ShellUser; size?: 'sm' | 'md' }) {
  const sizeClass = size === 'sm' ? 'size-9 text-sm' : 'size-11 text-base';
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-200',
        sizeClass,
      )}
    >
      {user?.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.name} className="size-full object-cover" />
      ) : (
        (user?.name || 'ب').trim().charAt(0)
      )}
    </div>
  );
}

function NavButton({
  item,
  onNavigate,
  compact = false,
}: {
  item: NavigationItem;
  onNavigate?: (href: string) => void;
  compact?: boolean;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <button
      type="button"
      onClick={() => onNavigate?.(item.href)}
      aria-current={item.isActive ? 'page' : undefined}
      className={cn(
        'ba-focus group relative flex h-10 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-start text-sm font-medium transition-[background-color,color] duration-[var(--duration-fast)]',
        item.isActive
          ? 'font-semibold text-brand-600 dark:text-brand-200'
          : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
        compact && 'justify-center px-2',
      )}
    >
      {item.isActive && !reduceMotion && (
        <m.span
          layoutId="active-nav"
          className="absolute inset-0 rounded-[var(--radius-md)] bg-brand-50 dark:bg-brand-950/45"
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <span className="relative z-10 flex size-[18px] shrink-0 items-center justify-center">
        {item.icon}
      </span>
      {!compact && <span className="relative z-10 flex-1 truncate">{item.label}</span>}
      {!compact && item.badge !== undefined && (
        <span className="relative z-10">
          <Badge tone="danger">{item.badge}</Badge>
        </span>
      )}
    </button>
  );
}

export function LearnerShell({ children, user, navigation, onNavigate, onLogout }: BaseShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomItems = navigation.slice(0, 5);

  return (
    <div className="student-app min-h-dvh bg-canvas text-ink" dir="rtl">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-[var(--radius-md)] bg-brand-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:right-4 focus:top-4"
      >
        تخطي إلى المحتوى
      </a>

      <header className="student-topbar sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-xl">
        <div className="ba-page flex h-16 items-center justify-between gap-4 px-5 lg:h-20 lg:px-8">
          <BrandMark />
          <nav aria-label="التنقل الرئيسي" className="hidden items-center gap-1 lg:flex">
            {navigation.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => onNavigate?.(item.href)}
                aria-current={item.isActive ? 'page' : undefined}
                className={cn(
                  'ba-focus inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-bold transition-colors',
                  item.isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/45 dark:text-brand-200'
                    : 'text-ink-3 hover:bg-surface-3 hover:text-ink',
                )}
              >
                <span className="flex size-4 items-center justify-center">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 border-l border-border pl-3 lg:flex">
              <ThemeSelector />
              <DataSaverToggle />
              <button
                type="button"
                onClick={() => onNavigate?.('/student/profile')}
                className="ba-focus flex items-center gap-2 rounded-xl px-2 py-1.5 text-start hover:bg-surface-3"
              >
                <Avatar user={user} size="sm" />
                <span className="max-w-32 truncate text-sm font-bold">{user?.name || 'طالب البحراوي'}</span>
              </button>
              <Button variant="ghost" size="icon" aria-label="تسجيل الخروج" onClick={onLogout}>
                <LogOut className="size-4 text-danger" />
              </Button>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" aria-label="الإشعارات">
              <Bell className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMenuOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu className="size-5" />
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="student-main ba-page min-h-[calc(100dvh-4rem)] w-full px-5 pb-24 pt-6 lg:px-8 lg:pb-12 lg:pt-9">
        {children}
      </main>

      <nav
        aria-label="التنقل الرئيسي للهاتف"
        className="fixed inset-x-0 bottom-0 z-30 flex h-16 items-center justify-around border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {bottomItems.map((item) => (
          <button
            key={item.href}
            type="button"
            onClick={() => onNavigate?.(item.href)}
            aria-current={item.isActive ? 'page' : undefined}
            className={cn(
              'ba-focus flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              item.isActive ? 'text-brand-500' : 'text-ink-3',
            )}
          >
            <span className="flex size-5 items-center justify-center">{item.icon}</span>
            <span className="max-w-full truncate">{item.label}</span>
          </button>
        ))}
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <LazyMotion features={domAnimation}>
            <m.div
              key="learner-mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed inset-0 z-50 lg:hidden"
            >
              <button
                aria-label="إغلاق القائمة"
                className="absolute inset-0 bg-ink/50"
                onClick={() => setMenuOpen(false)}
              />
              <m.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 right-0 flex w-[min(88vw,20rem)] flex-col bg-surface p-5 shadow-[var(--shadow-lg)]"
              >
                <div className="mb-6 flex items-center justify-between">
                  <BrandMark />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMenuOpen(false)}
                    aria-label="إغلاق"
                  >
                    <X className="size-5" />
                  </Button>
                </div>
                <nav className="flex-1 space-y-1">
                  {navigation.map((item) => (
                    <NavButton
                      key={item.href}
                      item={item}
                      onNavigate={(href) => {
                        setMenuOpen(false);
                        onNavigate?.(href);
                      }}
                    />
                  ))}
                </nav>
                <div className="mb-4 flex items-center gap-3 border-t border-border pt-4">
                  <Avatar user={user} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{user?.name || 'طالب البحراوي'}</p>
                    <p className="text-xs text-ink-3">{user?.role || 'طالب'}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="text-danger"
                  leadingIcon={<LogOut className="size-4" />}
                  onClick={onLogout}
                >
                  تسجيل الخروج
                </Button>
              </m.aside>
            </m.div>
          </LazyMotion>
        )}
      </AnimatePresence>
    </div>
  );
}

const staffGroups = [
  { label: 'Overview', match: ['dashboard'] },
  { label: 'Content', match: ['academic', 'courses', 'products', 'questions'] },
  { label: 'Students', match: ['students'] },
  { label: 'Operations', match: ['payments', 'support'] },
];

function staffGroupFor(item: NavigationItem) {
  const href = item.href.toLowerCase();
  return (
    staffGroups.find((group) => group.match.some((part) => href.includes(part)))?.label ??
    'Overview'
  );
}

export function StaffShell({ children, user, navigation, onNavigate, onLogout }: BaseShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const grouped = staffGroups.map((group) => ({
    ...group,
    items: navigation.filter((item) => staffGroupFor(item) === group.label),
  }));

  const nav = (
    <nav aria-label="Staff navigation" className="flex-1 space-y-5 overflow-y-auto">
      {grouped.map((group) =>
        group.items.length ? (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-xs font-semibold uppercase tracking-wide text-ink-4">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavButton key={item.href} item={item} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ) : null,
      )}
    </nav>
  );

  return (
    <div
      className="min-h-dvh bg-canvas text-ink lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]"
      dir="ltr"
    >
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-border bg-surface p-4 lg:flex">
        <div className="mb-2 border-b border-border pb-4">
          <BrandMark admin />
        </div>
        {nav}
        <div className="mt-auto border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-3">
            <Avatar user={user} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name || 'Staff member'}</p>
              <p className="truncate text-xs text-ink-3">{user?.role || 'Admin'}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="size-5" />
            </Button>
            <p className="font-heading text-base font-semibold">Bahrawy Academy</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSelector />
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Plus className="size-4" />}
              onClick={() => onNavigate?.('/dashboard/courses')}
            >
              New
            </Button>
          </div>
        </header>
        <main id="main-content" className="ba-page w-full px-4 py-6 lg:px-8">
          {children}
        </main>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <LazyMotion features={domAnimation}>
            <m.div
              key="staff-mobile-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="fixed inset-0 z-50 lg:hidden"
            >
              <button
                className="absolute inset-0 bg-ink/50"
                aria-label="Close menu"
                onClick={() => setMobileOpen(false)}
              />
              <m.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 left-0 flex w-[min(88vw,20rem)] flex-col bg-surface p-4 shadow-[var(--shadow-lg)]"
              >
                <div className="mb-6 flex items-center justify-between">
                  <BrandMark admin />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Close"
                  >
                    <X className="size-5" />
                  </Button>
                </div>
                {nav}
              </m.aside>
            </m.div>
          </LazyMotion>
        )}
      </AnimatePresence>
    </div>
  );
}

export function AppShell(props: BaseShellProps) {
  return <StaffShell {...props} />;
}
