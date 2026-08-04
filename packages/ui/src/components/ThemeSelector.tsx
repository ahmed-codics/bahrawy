'use client';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const THEME_TRANSITION_MS = 380;

function animateThemeChange() {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  root.classList.add('theme-switching');
  window.clearTimeout((root as { _themeTimer?: number })._themeTimer);
  (root as { _themeTimer?: number })._themeTimer = window.setTimeout(() => {
    root.classList.remove('theme-switching');
  }, THEME_TRANSITION_MS);
}

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="ba-skeleton size-11 rounded-xl" aria-hidden="true" />;
  }

  return (
    <button
      onClick={() => {
        animateThemeChange();
        setTheme(theme === 'dark' ? 'light' : 'dark');
      }}
      className="flex size-11 items-center justify-center rounded-xl border border-transparent text-text-muted transition duration-200 hover:border-border-default hover:bg-surface-soft hover:text-text-primary"
      aria-label="تغيير المظهر"
      title="تغيير المظهر"
    >
      {theme === 'dark' ? (
        <Sun className="size-5" aria-hidden="true" />
      ) : (
        <Moon className="size-5" aria-hidden="true" />
      )}
    </button>
  );
}
