'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Menu, X } from 'lucide-react';
import { ThemeSelector } from '@bahrawy/ui';
import { AcademyBrand } from './AcademyBrand';

export function PublicShell({
  children,
  active = 'home',
}: {
  children: React.ReactNode;
  active?: 'home' | 'courses';
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const controls = panelRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    controls?.[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !controls?.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  return (
    <div className="academy-public-flow">
      <a href="#main-content" className="academy-skip-link">
        تخطّي للمحتوى الرئيسي
      </a>
      <header className="academy-public-header">
        <div className="academy-container academy-public-nav">
          <Link href="/" aria-label="العودة إلى الصفحة الرئيسية">
            <AcademyBrand />
          </Link>

          <nav className="academy-public-links" aria-label="التنقل العام">
            <Link href="/" aria-current={active === 'home' ? 'page' : undefined}>
              الرئيسية
            </Link>
            <Link href="/courses" aria-current={active === 'courses' ? 'page' : undefined}>
              الكورسات
            </Link>
            <Link href="/#learning-path">نظام المذاكرة</Link>
            <Link href="/#teacher">عن مستر البحراوي</Link>
          </nav>

          <div className="academy-public-actions">
            <span className="academy-theme-control">
              <ThemeSelector />
            </span>
            <Link className="academy-login-link" href="/login">
              تسجيل الدخول
            </Link>
            <Link className="academy-button academy-button-sm" href="/#levels">
              اختار مرحلتك
              <ArrowLeft aria-hidden="true" />
            </Link>
          </div>

          <button
            type="button"
            className="academy-public-menu-button"
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة"
            aria-expanded={open}
          >
            <Menu aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="main-content">{children}</main>

      <footer className="academy-public-footer">
        <div className="academy-container academy-public-footer-grid">
          <div>
            <AcademyBrand />
            <p>شرح English منظم لطلاب الإعدادي والثانوي في النظام المصري.</p>
          </div>
          <div>
            <strong>ابدأ من هنا</strong>
            <Link href="/#levels">اختار مرحلتك</Link>
            <Link href="/courses">الكورسات</Link>
          </div>
          <div>
            <strong>حسابك</strong>
            <Link href="/login">تسجيل الدخول</Link>
            <Link href="/register">إنشاء حساب</Link>
          </div>
        </div>
        <div className="academy-public-footer-bottom">
          © {new Date().getFullYear()} أكاديمية السيد البحراوي. جميع الحقوق محفوظة.
        </div>
      </footer>

      {open && (
        <div
          className="academy-public-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="قائمة التنقل"
        >
          <button
            className="academy-public-drawer-scrim"
            aria-label="إغلاق القائمة"
            onClick={() => setOpen(false)}
          />
          <div ref={panelRef} className="academy-public-drawer-panel">
            <div className="academy-public-drawer-head">
              <AcademyBrand />
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق القائمة">
                <X aria-hidden="true" />
              </button>
            </div>
            <nav>
              <Link href="/" onClick={() => setOpen(false)}>
                الرئيسية
              </Link>
              <Link href="/courses" onClick={() => setOpen(false)}>
                الكورسات
              </Link>
              <Link href="/#learning-path" onClick={() => setOpen(false)}>
                نظام المذاكرة
              </Link>
              <Link href="/#teacher" onClick={() => setOpen(false)}>
                عن مستر البحراوي
              </Link>
            </nav>
            <div className="academy-public-drawer-actions">
              <span className="academy-theme-control">
                <ThemeSelector />
              </span>
              <Link className="academy-button" href="/login" onClick={() => setOpen(false)}>
                تسجيل الدخول
                <ArrowLeft aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
