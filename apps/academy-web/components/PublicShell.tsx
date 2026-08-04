'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Menu, Sparkles, X } from 'lucide-react';
import { PremiumBrand } from './PremiumBrand';
import { FollowUs } from './FollowUs';

type ActiveKey = 'levels' | 'about' | 'learn';

const NAV_LINKS: { key: ActiveKey; label: string; href: string }[] = [
  { key: 'levels', label: 'المراحل', href: '/#levels' },
  { key: 'about', label: 'عن مستر البحراوي', href: '/#learning-path' },
  { key: 'learn', label: 'هتتعلم إزاي؟', href: '/#teacher' },
];

const ACTIVE_BY_ID: Record<string, ActiveKey> = {
  levels: 'levels',
  'learning-path': 'about',
  teacher: 'learn',
};

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function PremiumNavLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const move = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (prefersReducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const mx = Math.max(-4, Math.min(4, dx * 0.14));
    const my = Math.max(-3, Math.min(3, dy * 0.14));
    el.style.setProperty('--mag-x', `${mx.toFixed(2)}px`);
    el.style.setProperty('--mag-y', `${my.toFixed(2)}px`);
  };

  const reset = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--mag-x', '0px');
    el.style.setProperty('--mag-y', '0px');
  };

  return (
    <Link
      ref={ref}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`academy-premium-link${active ? ' is-active' : ''}`}
      onMouseMove={move}
      onMouseLeave={reset}
      onFocus={reset}
    >
      {label}
    </Link>
  );
}

export function PublicShell({
  children,
}: {
  children: React.ReactNode;
  active?: 'home' | 'courses';
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveKey | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);

  const handleNavMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion()) return;
    const el = navRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  };

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        setScrolled(window.scrollY > 40);
        raf = 0;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

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

  useEffect(() => {
    if (pathname !== '/') return;
    const sections = Object.keys(ACTIVE_BY_ID)
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    const update = () => {
      let current: ActiveKey | null = null;
      for (const el of sections) {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.55 && rect.bottom > window.innerHeight * 0.45) {
          current = ACTIVE_BY_ID[el.id];
          break;
        }
      }
      setActiveSection(current);
    };

    const observer = new IntersectionObserver(update, {
      rootMargin: '-45% 0px -45% 0px',
      threshold: 0,
    });
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    if (pathname !== '/') return;
    const id = window.location.hash.slice(1);
    if (!id || !ACTIVE_BY_ID[id]) return;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(ACTIVE_BY_ID[id]);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  const activeKey: ActiveKey | null = pathname === '/' ? activeSection : null;

  return (
    <div className="academy-public-flow">
      <a href="#main-content" className="academy-skip-link">
        تخطّي للمحتوى الرئيسي
      </a>

      <header className={`academy-premium-header${scrolled ? ' is-scrolled' : ''}`}>
        <div
          ref={navRef}
          className="academy-premium-nav"
          onMouseMove={handleNavMouseMove}
        >
          <span className="academy-premium-nav-fx" aria-hidden="true" />
          <span className="academy-premium-nav-spot" aria-hidden="true" />

          <Link href="/" className="academy-premium-brand-link" aria-label="أكاديمية البحراوي — الصفحة الرئيسية">
            <PremiumBrand />
          </Link>

          <nav className="academy-premium-links" aria-label="التنقل العام">
            {NAV_LINKS.map((item) => (
              <PremiumNavLink
                key={item.key}
                href={item.href}
                label={item.label}
                active={activeKey === item.key}
              />
            ))}
          </nav>

          <div className="academy-premium-actions">
            <Link className="academy-premium-login" href="/login">
              دخول
            </Link>
            <Link className="academy-premium-cta" href="/register">
              اشترك الآن
              <Sparkles aria-hidden="true" />
            </Link>
          </div>

          <button
            type="button"
            className="academy-premium-menu-toggle"
            onClick={() => setOpen(true)}
            aria-label="فتح القائمة"
            aria-expanded={open}
            aria-haspopup="dialog"
          >
            <Menu aria-hidden="true" />
          </button>
        </div>
      </header>

      <main id="main-content">{children}</main>

      <footer className="academy-public-footer">
        <div className="academy-container academy-public-footer-grid">
          <div>
            <PremiumBrand />
            <p>شرح English منظم لطلاب الإعدادي والثانوي في النظام المصري.</p>
          </div>
          <div>
            <strong>ابدأ من هنا</strong>
            <Link href="/#levels">اختار مرحلتك</Link>
            <Link href="/courses">الكورسات</Link>
            <Link href="/login">تسجيل الدخول</Link>
            <Link href="/register">إنشاء حساب</Link>
          </div>
          <FollowUs />
        </div>
        <div className="academy-public-footer-bottom">
          © {new Date().getFullYear()} أكاديمية السيد البحراوي. جميع الحقوق محفوظة.
        </div>
      </footer>

      {open && (
        <div className="academy-premium-menu" role="dialog" aria-modal="true" aria-label="قائمة التنقل">
          <button
            className="academy-premium-menu-scrim"
            aria-label="إغلاق القائمة"
            onClick={() => setOpen(false)}
          />
          <div ref={panelRef} className="academy-premium-menu-panel">
            <div className="academy-premium-menu-head">
              <PremiumBrand />
              <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق القائمة">
                <X aria-hidden="true" />
              </button>
            </div>
            <nav className="academy-premium-menu-links">
              {NAV_LINKS.map((item, index) => (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`academy-premium-menu-link${activeKey === item.key ? ' is-active' : ''}`}
                  style={{ animationDelay: `${index * 60}ms` }}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="academy-premium-menu-actions">
              <Link className="academy-premium-menu-login" href="/login" onClick={() => setOpen(false)}>
                تسجيل الدخول
              </Link>
              <Link className="academy-premium-menu-cta" href="/register" onClick={() => setOpen(false)}>
                اشترك الآن
                <ArrowLeft aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
