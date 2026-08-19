'use client';

import React, { type ReactNode, useEffect, useState } from 'react';
import {
  BookPlus,
  KeyRound,
  LogOut,
  Menu,
  PackagePlus,
  Palette,
  Plus,
  Settings2,
  UserPlus,
  UsersRound,
  X,
} from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { cn } from '../utils';
import { BrandMark } from './BrandMark';
import { Button } from './Button';
import { DataSaverToggle } from './DataSaverToggle';
import { ThemeSelector } from './ThemeSelector';
import { Badge } from './Primitives';
import { MobileSheet } from './MobileSheet';

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
  focusedMode?: boolean;
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
  variant = 'default',
}: {
  item: NavigationItem;
  onNavigate?: (href: string) => void;
  compact?: boolean;
  variant?: 'default' | 'vivid';
}) {
  const reduceMotion = useReducedMotion();
  const vivid = variant === 'vivid';

  return (
    <button
      type="button"
      onClick={() => onNavigate?.(item.href)}
      aria-current={item.isActive ? 'page' : undefined}
      className={cn(
        'ba-focus group relative flex h-11 w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 text-start text-sm transition-[background-color,color,box-shadow] duration-[var(--duration-fast)] touch-manipulation',
        vivid
          ? item.isActive
            ? 'font-bold text-white shadow-[0_8px_18px_rgb(37_99_235/0.4)] bg-gradient-to-l from-brand-600 to-brand-500'
            : 'font-medium text-brand-800 bg-brand-50/90 hover:bg-brand-100 hover:text-brand-900'
          : item.isActive
            ? 'font-semibold text-brand-600 dark:text-brand-200'
            : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
        compact && 'justify-center px-2',
      )}
    >
      {item.isActive && !reduceMotion && !vivid && (
        <m.span
          layoutId="active-nav"
          className="absolute inset-0 rounded-[var(--radius-md)] bg-brand-50 dark:bg-brand-950/45"
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
      <span
        className={cn(
          'relative z-10 flex size-[18px] shrink-0 items-center justify-center',
          vivid && !item.isActive && '[&>svg]:text-brand-600',
        )}
      >
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

export function LearnerShell({
  children,
  user,
  navigation,
  onNavigate,
  onLogout,
}: BaseShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [menuOpen]);

  return (
    <div className="student-app min-h-dvh bg-canvas text-ink" dir="rtl">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-[var(--radius-md)] bg-brand-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:right-4 focus:top-4"
      >
        تخطي إلى المحتوى
      </a>

      <div
        aria-hidden="true"
        className="menu-hint-arrow pointer-events-none fixed left-[34px] top-[calc(50%-1.9rem)] z-[80] -translate-x-1/2 -translate-y-full text-brand-600 dark:text-brand-400"
        style={{
          opacity: reduceMotion ? 0.4 : 0.35,
          ...(reduceMotion
            ? {}
            : { animation: 'menu-hint-pulse 2.4s ease-in-out 3 forwards' }),
        }}
      >
        <style>{`
          @keyframes menu-hint-pulse {
            0%, 100% { opacity: 0.35; transform: none; }
            50% { opacity: 0.5; transform: translateY(-3px); }
          }
        `}</style>
        <svg
          width="28"
          height="36"
          viewBox="0 0 28 36"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M14 3 C 21 3, 26 8, 22 13 C 18 18, 11 15, 10 10.5 C 9.3 7.4, 12 5.6, 14.5 7.4 L 14.5 26"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M14.5 33 L 10.5 27 L 18.5 27 Z"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      </div>

      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="فتح القائمة"
        aria-expanded={menuOpen}
        className="ba-focus fixed left-3 top-1/2 z-[80] flex size-11 -translate-y-1/2 flex-col items-center justify-center gap-[5px] rounded-full border border-brand-400 bg-gradient-to-b from-brand-600 to-brand-700 text-white shadow-[0_8px_20px_rgb(37_99_235/0.45)] transition-all touch-manipulation hover:from-brand-500 hover:to-brand-600 hover:shadow-[0_10px_24px_rgb(37_99_235/0.55)]"
      >
        <span className="h-[2px] w-5 rounded-full bg-current" />
        <span className="h-[2px] w-5 rounded-full bg-current" />
        <span className="h-[2px] w-5 rounded-full bg-current" />
      </button>

      <main
        id="main-content"
        className={cn(
          'student-main min-h-dvh w-full min-w-0 px-[var(--mobile-gutter)] pt-4 sm:px-5 sm:pt-6 lg:px-8 lg:pb-12 lg:pt-9',
          'pb-[calc(1.5rem+env(safe-area-inset-bottom))]',
        )}
      >
        {children}
      </main>

      <AnimatePresence>
        {menuOpen && (
          <LazyMotion features={domAnimation}>
            <m.div
              className="fixed inset-0 z-[70]"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.18 }}
            >
              <button
                type="button"
                className="absolute inset-0 size-full bg-black/55"
                aria-label="إغلاق القائمة"
                onClick={() => setMenuOpen(false)}
              />
              <m.aside
                role="dialog"
                aria-modal="true"
                aria-label="قائمة التنقل"
                className="absolute inset-y-0 right-0 flex max-w-[85vw] flex-col border-l border-border bg-surface shadow-[var(--shadow-xl)] overscroll-contain pt-[max(env(safe-area-inset-top),0px)] pb-[env(safe-area-inset-bottom)]"
                style={{ width: 'min(85vw, 19rem)' }}
                initial={reduceMotion ? false : { x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4">
                  <BrandMark className="max-w-[11rem]" />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMenuOpen(false)}
                    aria-label="إغلاق القائمة"
                  >
                    <X className="size-5" />
                  </Button>
                </div>

                <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
                  <Avatar user={user} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">{user?.name || 'طالب البحراوي'}</p>
                    <p className="text-xs text-ink-3">{user?.role || 'طالب'}</p>
                  </div>
                </div>

                <nav
                  className="mt-4 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-2"
                  aria-label="التنقل الرئيسي"
                >
                  {navigation.map((item) => (
                    <NavButton
                      key={item.href}
                      item={item}
                      variant="vivid"
                      onNavigate={(href) => {
                        setMenuOpen(false);
                        onNavigate?.(href);
                      }}
                    />
                  ))}
                </nav>

                <div className="border-t border-border p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex min-h-14 items-center justify-between rounded-xl border border-border bg-surface-2 px-3">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <Palette className="size-4 text-brand-600" /> المظهر
                      </span>
                      <ThemeSelector />
                    </div>
                    <div className="flex min-h-14 items-center justify-between rounded-xl border border-border bg-surface-2 px-3">
                      <span className="flex items-center gap-2 text-sm font-bold">
                        <Settings2 className="size-4 text-brand-600" /> التوفير
                      </span>
                      <DataSaverToggle />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-3 w-full justify-start"
                    leadingIcon={<KeyRound className="size-4" />}
                    onClick={() => {
                      setMenuOpen(false);
                      onNavigate?.('/change-password');
                    }}
                  >
                    تغيير كلمة المرور
                  </Button>
                  <Button
                    variant="ghost"
                    className="mt-1 w-full justify-start text-danger"
                    leadingIcon={<LogOut className="size-4" />}
                    onClick={onLogout}
                  >
                    تسجيل الخروج
                  </Button>
                </div>
              </m.aside>
            </m.div>
          </LazyMotion>
        )}
      </AnimatePresence>
    </div>
  );
}

export function GuardianShell({
  children,
  user,
  onNavigate,
  onLogout,
}: Omit<BaseShellProps, 'navigation'>) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="student-app min-h-dvh bg-canvas text-ink" dir="rtl">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-xl bg-brand-600 px-4 py-2 text-white focus:not-sr-only focus:fixed focus:right-4 focus:top-4"
      >
        تخطي إلى المحتوى
      </a>
      <header className="student-topbar sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-3 px-[var(--mobile-gutter)] sm:px-5 lg:h-20 lg:px-8">
          <BrandMark className="max-w-[13rem] sm:max-w-none" />
          <Button variant="ghost" size="icon" onClick={() => setMenuOpen(true)} aria-label="فتح القائمة">
            <Menu className="size-5" />
          </Button>
        </div>
      </header>
      <main
        id="main-content"
        className="student-main mx-auto min-h-[calc(100dvh-4rem)] w-full min-w-0 px-[var(--mobile-gutter)] py-5 sm:px-5 sm:py-7 lg:px-8 lg:py-10"
      >
        {children}
      </main>
      <MobileSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="حساب ولي الأمر"
        description="الإعدادات ومتابعة الأبناء"
      >
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-surface-2 p-4">
          <Avatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-black">{user?.name || 'ولي الأمر'}</p>
            <p className="text-xs text-ink-3">{user?.role || 'ولي أمر'}</p>
          </div>
        </div>
        <Button
          className="w-full justify-start"
          variant="ghost"
          onClick={() => {
            setMenuOpen(false);
            onNavigate?.('/guardian');
          }}
        >
          متابعة الأبناء
        </Button>
        <div className="my-4 grid grid-cols-2 gap-3">
          <div className="flex min-h-14 items-center justify-between rounded-xl border border-border bg-surface-2 px-3">
            <span className="text-sm font-bold">المظهر</span>
            <ThemeSelector />
          </div>
          <div className="flex min-h-14 items-center justify-between rounded-xl border border-border bg-surface-2 px-3">
            <span className="text-sm font-bold">التوفير</span>
            <DataSaverToggle />
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-danger"
          leadingIcon={<LogOut className="size-4" />}
          onClick={onLogout}
        >
          تسجيل الخروج
        </Button>
      </MobileSheet>
    </div>
  );
}

const staffGroups = [
  { label: 'نظرة عامة', match: ['/dashboard'] },
  { label: 'الأكاديمية', match: ['/dashboard/academic'] },
  {
    label: 'المحتوى',
    match: ['/dashboard/courses', '/dashboard/questions'],
  },
  {
    label: 'التجارة',
    match: ['/dashboard/products', '/dashboard/payments'],
  },
  { label: 'الأشخاص', match: ['/dashboard/students', '/dashboard/staff'] },
  { label: 'العمليات', match: ['/dashboard/support'] },
  {
    label: 'الحوكمة',
    match: ['/dashboard/audit', '/dashboard/settings'],
  },
];

function staffGroupFor(item: NavigationItem) {
  const href = item.href.toLowerCase();
  if (href === '/dashboard') return 'نظرة عامة';
  return (
    staffGroups
      .slice(1)
      .find((group) => group.match.some((part) => href.startsWith(part)))?.label ??
    'نظرة عامة'
  );
}

export function StaffShell({ children, user, navigation, onNavigate, onLogout }: BaseShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const createActions = [
    navigation.some((item) => item.href.startsWith('/dashboard/courses'))
      ? {
          label: 'كورس جديد',
          description: 'إنشاء كورس كمسودة ثم بناء المنهج',
          href: '/dashboard/courses/new',
          icon: <BookPlus className="size-5" />,
        }
      : null,
    navigation.some((item) => item.href.startsWith('/dashboard/products'))
      ? {
          label: 'باقة جديدة',
          description: 'تجميع كورسات ووحدات في منتج واحد',
          href: '/dashboard/products?create=1',
          icon: <PackagePlus className="size-5" />,
        }
      : null,
    navigation.some((item) => item.href.startsWith('/dashboard/students'))
      ? {
          label: 'طالب جديد',
          description: 'إنشاء حساب طالب ببيانات دخول مؤقتة',
          href: '/dashboard/students?create=1',
          icon: <UserPlus className="size-5" />,
        }
      : null,
    navigation.some((item) => item.href.startsWith('/dashboard/staff'))
      ? {
          label: 'عضو فريق جديد',
          description: 'إضافة موظف أو مساعد وتحديد دوره',
          href: '/dashboard/staff?create=1',
          icon: <UsersRound className="size-5" />,
        }
      : null,
  ].filter((action): action is NonNullable<typeof action> => Boolean(action));
  const grouped = staffGroups.map((group) => ({
    ...group,
    items: navigation.filter((item) => staffGroupFor(item) === group.label),
  }));

  const nav = (
    <nav aria-label="التنقل في مركز الإدارة" className="flex-1 space-y-5 overflow-y-auto">
      {grouped.map((group) =>
        group.items.length ? (
          <div key={group.label}>
            <p className="mb-1.5 px-3 text-xs font-bold text-ink-4">
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
    <div className="min-h-dvh bg-canvas text-ink" dir="rtl">
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-64 flex-col border-l border-border bg-surface p-4 lg:flex">
        <div className="mb-2 border-b border-border pb-4">
          <BrandMark admin />
        </div>
        {nav}
        <div className="mt-auto border-t border-border pt-4">
          <div className="mb-3 flex items-center gap-3">
            <Avatar user={user} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name || 'عضو فريق'}</p>
              <p className="truncate text-xs text-ink-3">{user?.role || 'الإدارة'}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start" onClick={onLogout}>
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      <div className="min-w-0 lg:mr-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="فتح القائمة"
            >
              <Menu className="size-5" />
            </Button>
            <p className="font-heading text-base font-semibold">مركز إدارة أكاديمية البحراوي</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeSelector />
            {createActions.length > 0 && (
              <Button
                variant="primary"
                size="sm"
                leadingIcon={<Plus className="size-4" />}
                onClick={() => setCreateOpen(true)}
              >
                إنشاء
              </Button>
            )}
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
                aria-label="إغلاق القائمة"
                onClick={() => setMobileOpen(false)}
              />
              <m.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-y-0 right-0 flex w-[min(88vw,20rem)] flex-col bg-surface p-4 shadow-[var(--shadow-lg)]"
              >
                <div className="mb-6 flex items-center justify-between">
                  <BrandMark admin />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileOpen(false)}
                    aria-label="إغلاق"
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
      <MobileSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="إنشاء سجل جديد"
        description="اختر الإجراء المتاح وفق صلاحياتك."
      >
        <div className="grid gap-3 sm:grid-cols-2" dir="rtl">
          {createActions.map((action) => (
            <button
              key={action.href}
              type="button"
              className="ba-focus flex min-h-24 items-start gap-3 rounded-2xl border border-border bg-surface-2 p-4 text-start transition hover:border-brand-400 hover:bg-brand-50/50"
              onClick={() => {
                setCreateOpen(false);
                onNavigate?.(action.href);
              }}
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700">
                {action.icon}
              </span>
              <span>
                <strong className="block text-sm text-ink">{action.label}</strong>
                <span className="mt-1 block text-xs leading-5 text-ink-3">
                  {action.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </MobileSheet>
    </div>
  );
}

export function AppShell(props: BaseShellProps) {
  return <StaffShell {...props} />;
}
