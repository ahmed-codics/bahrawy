#!/usr/bin/env python3
"""
Fix contrast issues: make borders, text, and UI elements properly visible on light backgrounds.
The palette should be:
  - Backgrounds: white/off-white
  - Borders: clearly visible gray (#d1d5db)
  - Text: near-black (#111827)
  - Primary brand: teal/cyan (#0891b2) - vibrant and distinct from white
  - Buttons: solid teal with white text
  - Navbar: white with visible border and dark text
"""

# ── 1. Fix globals.css ──────────────────────────────────────────────────────
with open('/home/deploy/bahrawy/apps/academy-web/app/globals.css', 'r') as f:
    css = f.read()

# Fix .academy-landing palette — proper contrast colors
css = css.replace('    --academy-cyan: #00aeca;', '    --academy-cyan: #0891b2;')
css = css.replace('    --academy-cyan-strong: #008aa5;', '    --academy-cyan-strong: #0e7490;')
css = css.replace('    --academy-cyan-soft: #e3f9fc;', '    --academy-cyan-soft: #ecfeff;')
css = css.replace('    --academy-navy: #18181b;', '    --academy-navy: #111827;')
css = css.replace('    --academy-navy-soft: #3f3f46;', '    --academy-navy-soft: #374151;')
css = css.replace('    --academy-text: #18181b;', '    --academy-text: #111827;')
css = css.replace('    --academy-muted: #71717a;', '    --academy-muted: #6b7280;')
css = css.replace('    --academy-border: #e4e4e7;', '    --academy-border: #d1d5db;')
css = css.replace('    --academy-surface-soft: #f4f9fa;', '    --academy-surface-soft: #f9fafb;')
css = css.replace('    --academy-canvas: #f7f6f3;', '    --academy-canvas: #f9fafb;')
css = css.replace('    --academy-header: rgba(255,255,255,0.9);', '    --academy-header: rgba(255, 255, 255, 0.95);')
css = css.replace('    --academy-shadow: 0 12px 40px rgba(15,23,42,0.08);', '    --academy-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);')

# Fix .academy-public-flow palette (same palette but listed separately)
css = css.replace(
    '    --academy-navy: #18181b;\n    --academy-navy-soft: #3f3f46;\n    --academy-amber: #f59e0b;\n    --academy-canvas: #f7f6f3;\n    --academy-surface: #ffffff;\n    --academy-surface-soft: #f4f9fa;\n    --academy-text: #18181b;\n    --academy-muted: #71717a;\n    --academy-border: #e4e4e7;\n    --academy-header: rgba(255,255,255,0.9);\n    --academy-shadow: 0 12px 40px rgba(15,23,42,0.08);',
    '    --academy-navy: #111827;\n    --academy-navy-soft: #374151;\n    --academy-amber: #f59e0b;\n    --academy-canvas: #f9fafb;\n    --academy-surface: #ffffff;\n    --academy-surface-soft: #f9fafb;\n    --academy-text: #111827;\n    --academy-muted: #6b7280;\n    --academy-border: #d1d5db;\n    --academy-header: rgba(255, 255, 255, 0.95);\n    --academy-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);'
)

# Fix student topbar - give it a proper border
css = css.replace(
    '  border-color: var(--academy-border, #e4e4e7);\n  background: rgba(255, 255, 255, 0.95);\n  color: #18181b;\n  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);',
    '  border-color: #e5e7eb;\n  background: #ffffff;\n  color: #111827;\n  box-shadow: 0 1px 0 #e5e7eb, 0 2px 8px rgba(0, 0, 0, 0.04);'
)
css = css.replace(
    "  .student-topbar [class*='text-ink'] {\n  color: #71717a;\n}",
    "  .student-topbar [class*='text-ink'] {\n  color: #6b7280;\n}"
)
css = css.replace(
    '  .student-topbar button:hover {\n  color: #18181b;\n}',
    '  .student-topbar button:hover {\n  color: #111827;\n}'
)

# Fix student-app bg
css = css.replace(
    '  background: #f7f6f3;',
    '  background: #f9fafb;'
)

# Fix student-hero to have cyan top and readable text
css = css.replace(
    '  border: 1px solid rgb(0 174 202 / 15%);\n  border-radius: clamp(1.5rem, 3vw, 2.35rem);\n  background:\n    radial-gradient(circle at 12% 0%, rgb(0 174 202 / 12%), transparent 22rem),\n    linear-gradient(135deg, #ecfcff 0%, #e0f9fc 60%, #d4f5f9 100%);\n  color: #0a3d47;\n  box-shadow: 0 12px 40px rgba(0, 174, 202, 0.12);',
    '  border: 1px solid #a5f3fc;\n  border-radius: clamp(1.5rem, 3vw, 2.35rem);\n  background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);\n  color: #ffffff;\n  box-shadow: 0 12px 40px rgba(8, 145, 178, 0.2);'
)

# Fix the hero grid overlay - make it visible on teal background
css = css.replace(
    '    background-image:\n    linear-gradient(rgb(0 174 202 / 15%) 1px, transparent 1px),\n    linear-gradient(90deg, rgb(0 174 202 / 15%) 1px, transparent 1px);',
    '    background-image:\n    linear-gradient(rgba(255, 255, 255, 0.08) 1px, transparent 1px),\n    linear-gradient(90deg, rgba(255, 255, 255, 0.08) 1px, transparent 1px);'
)

# Fix student-kicker to work on teal background
css = css.replace(
    '  border: 1px solid rgb(0 174 202 / 30%);\n  border-radius: 999px;\n  background: rgb(0 174 202 / 10%);\n  padding: 0.35rem 0.75rem;\n  color: #007f99;',
    '  border: 1px solid rgba(255, 255, 255, 0.35);\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.15);\n  padding: 0.35rem 0.75rem;\n  color: #ffffff;'
)

# Fix student-panel
css = css.replace(
    '  border: 1px solid #e4e4e7;\n  border-radius: 1.5rem;\n  background: #ffffff;\n  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);',
    '  border: 1px solid #e5e7eb;\n  border-radius: 1.5rem;\n  background: #ffffff;\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(0,0,0,0.03);'
)

# Fix student-course-card
css = css.replace(
    '  border: 1px solid #e4e4e7;\n  border-radius: 1.6rem;\n  background: #ffffff;\n  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);',
    '  border: 1px solid #e5e7eb;\n  border-radius: 1.6rem;\n  background: #ffffff;\n  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);'
)
css = css.replace(
    '  border-color: rgb(0 174 202 / 40%);\n  box-shadow: 0 16px 40px rgba(0, 174, 202, 0.1);',
    '  border-color: #0891b2;\n  box-shadow: 0 8px 24px rgba(8, 145, 178, 0.12);'
)

# Fix student-cover (course image placeholder)
css = css.replace(
    '    radial-gradient(circle at 20% 10%, rgb(0 174 202 / 20%), transparent 14rem),\n    linear-gradient(135deg, #d4f5f9, #a8eef5);',
    '    radial-gradient(circle at 20% 10%, rgba(8, 145, 178, 0.3), transparent 14rem),\n    linear-gradient(135deg, #0891b2, #0e7490);'
)

# Fix navbar (academy-header) - make border visible
css = css.replace(
    '    backdrop-filter: blur(14px);',
    '    border: 1px solid #e5e7eb;\n    backdrop-filter: blur(14px);'
)

# Fix skip link - it's now cyan-strong background, good
# Fix academy-nav-link active/hover - was --academy-cyan-strong which is now #0e7490, that's fine

# Fix .academy-nav-link color (currently color: var(--academy-cyan-strong) which we changed to replaces of navy)
# The active links should be cyan-strong (#0e7490), that's fine on white.
# But we may have over-replaced some things. Let's just make sure the default nav link text is dark.
css = css.replace(
    '    color: var(--academy-cyan-strong);\n  }\n\n  .academy-desktop-links a:hover::after {',
    '    color: var(--academy-cyan-strong);\n  }\n\n  .academy-desktop-links a {\n    color: var(--academy-text);\n  }\n\n  .academy-desktop-links a:hover::after {'
)

with open('/home/deploy/bahrawy/apps/academy-web/app/globals.css', 'w') as f:
    f.write(css)
print('globals.css contrast fixed.')


# ── 2. Fix theme.css ────────────────────────────────────────────────────────
with open('/home/deploy/bahrawy/packages/ui/styles/theme.css', 'r') as f:
    theme = f.read()

# Brand = teal/cyan
theme = theme.replace('--color-brand-50: #eef2ff;', '--color-brand-50: #ecfeff;')
theme = theme.replace('--color-brand-100: #e0e7ff;', '--color-brand-100: #cffafe;')
theme = theme.replace('--color-brand-200: #c7d2fe;', '--color-brand-200: #a5f3fc;')
theme = theme.replace('--color-brand-300: #a5b4fc;', '--color-brand-300: #67e8f9;')
theme = theme.replace('--color-brand-400: #818cf8;', '--color-brand-400: #22d3ee;')
theme = theme.replace('--color-brand-500: #6366f1;', '--color-brand-500: #0891b2;')
theme = theme.replace('--color-brand-600: #4f46e5;', '--color-brand-600: #0e7490;')
theme = theme.replace('--color-brand-700: #4338ca;', '--color-brand-700: #155e75;')
theme = theme.replace('--color-brand-800: #3730a3;', '--color-brand-800: #164e63;')
theme = theme.replace('--color-brand-900: #312e81;', '--color-brand-900: #0c4a6e;')
theme = theme.replace('--color-brand-950: #1e1b4b;', '--color-brand-950: #082f49;')

# Ink = proper dark gray (readable on white)
theme = theme.replace('--color-ink: #18181b;', '--color-ink: #111827;')
theme = theme.replace('--color-ink-2: #3f3f46;', '--color-ink-2: #1f2937;')
theme = theme.replace('--color-ink-3: #71717a;', '--color-ink-3: #6b7280;')
theme = theme.replace('--color-ink-4: #a1a1aa;', '--color-ink-4: #9ca3af;')

# Canvas/surfaces
theme = theme.replace('--color-canvas: #f7f6f3;', '--color-canvas: #f9fafb;')
theme = theme.replace('--color-surface-2: #fafaf9;', '--color-surface-2: #f3f4f6;')
theme = theme.replace('--color-surface-3: #f4f4f5;', '--color-surface-3: #e5e7eb;')
theme = theme.replace('--color-border: #e4e4e7;', '--color-border: #e5e7eb;')
theme = theme.replace('--color-border-2: #d4d4d8;', '--color-border-2: #d1d5db;')

# Fix text-muted alias
theme = theme.replace('--color-text-muted: var(--color-ink-3);', '--color-text-muted: var(--color-ink-3);')

# Tighten radius a bit
theme = theme.replace('--radius-sm: 0.375rem;', '--radius-sm: 0.375rem;')

with open('/home/deploy/bahrawy/packages/ui/styles/theme.css', 'w') as f:
    f.write(theme)
print('theme.css contrast fixed.')

print('Done! Rebuild the container.')
