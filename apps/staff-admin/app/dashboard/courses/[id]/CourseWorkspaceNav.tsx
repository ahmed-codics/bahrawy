'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BookOpen, LayoutDashboard, Settings, ShoppingBag } from 'lucide-react';

export function CourseWorkspaceNav({ courseId }: { courseId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/courses/${courseId}`;
  const items = [
    { href: base, label: 'نظرة عامة', icon: LayoutDashboard, exact: true },
    { href: `${base}/curriculum`, label: 'المنهج', icon: BookOpen },
    { href: `${base}/commerce`, label: 'الوصول والسعر', icon: ShoppingBag },
    { href: `${base}/settings`, label: 'الإعدادات والنشر', icon: Settings },
  ];

  return (
    <nav
      aria-label="أقسام إدارة الكورس"
      className="mb-6 flex gap-2 overflow-x-auto border-b border-border pb-3"
      dir="rtl"
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`ba-focus inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-bold ${
              active
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-200'
                : 'text-ink-3 hover:bg-surface-2 hover:text-ink'
            }`}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
