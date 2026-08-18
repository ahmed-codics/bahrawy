#!/usr/bin/env python3
"""
Fix academy-web to be light-mode only.
- Remove all .dark {...} CSS blocks from globals.css and theme.css
- Replace dark navy (#09233f, #163b5f) with proper neutral/brand light colors
- Fix button colors, navbar, cards, hero sections
- Replace dark student-hero/topbar with clean light equivalents
"""

import re

# ───────────────────────────────────────────────
# 1. THEME.CSS — remove .dark block
# ───────────────────────────────────────────────
with open('/home/deploy/bahrawy/packages/ui/styles/theme.css', 'r') as f:
    theme = f.read()

# Remove the entire .dark { ... } block
theme = re.sub(r'\s*\.dark \{[^}]*\}', '', theme)

# Make sure brand colors are indigo (good for light theme)
theme = theme.replace('--color-brand-50: #eff6ff;', '--color-brand-50: #eef2ff;')
theme = theme.replace('--color-brand-100: #dbeafe;', '--color-brand-100: #e0e7ff;')
theme = theme.replace('--color-brand-200: #bfdbfe;', '--color-brand-200: #c7d2fe;')
theme = theme.replace('--color-brand-300: #93c5fd;', '--color-brand-300: #a5b4fc;')
theme = theme.replace('--color-brand-400: #60a5fa;', '--color-brand-400: #818cf8;')
theme = theme.replace('--color-brand-500: #3b82f6;', '--color-brand-500: #6366f1;')
theme = theme.replace('--color-brand-600: #2563eb;', '--color-brand-600: #4f46e5;')
theme = theme.replace('--color-brand-700: #1d4ed8;', '--color-brand-700: #4338ca;')
theme = theme.replace('--color-brand-800: #1e40af;', '--color-brand-800: #3730a3;')
theme = theme.replace('--color-brand-900: #1e3a8a;', '--color-brand-900: #312e81;')
theme = theme.replace('--color-brand-950: #172554;', '--color-brand-950: #1e1b4b;')

# Fix ink colors to be warm-neutral (not slate/blue)
theme = theme.replace('--color-ink: #171717;', '--color-ink: #18181b;')
theme = theme.replace('--color-ink-2: #262626;', '--color-ink-2: #3f3f46;')
theme = theme.replace('--color-ink-3: #525252;', '--color-ink-3: #71717a;')
theme = theme.replace('--color-ink-4: #a3a3a3;', '--color-ink-4: #a1a1aa;')

# Fix canvas/surface to be warm white
theme = theme.replace('--color-canvas: #f8fafc;', '--color-canvas: #f7f6f3;')
theme = theme.replace('--color-surface-2: #f1f5f9;', '--color-surface-2: #fafaf9;')
theme = theme.replace('--color-surface-3: #e2e8f0;', '--color-surface-3: #f4f4f5;')
theme = theme.replace('--color-border: #e2e8f0;', '--color-border: #e4e4e7;')
theme = theme.replace('--color-border-2: #cbd5e1;', '--color-border-2: #d4d4d8;')

# Fix border radius to be tighter
theme = theme.replace('--radius-sm: 0.5rem;', '--radius-sm: 0.375rem;')
theme = theme.replace('--radius-md: 0.75rem;', '--radius-md: 0.625rem;')
theme = theme.replace('--radius-lg: 1rem;', '--radius-lg: 0.875rem;')
theme = theme.replace('--radius-xl: 1.5rem;', '--radius-xl: 1.25rem;')

with open('/home/deploy/bahrawy/packages/ui/styles/theme.css', 'w') as f:
    f.write(theme)
print('theme.css fixed.')


# ───────────────────────────────────────────────
# 2. GLOBALS.CSS — the big one
# ───────────────────────────────────────────────
with open('/home/deploy/bahrawy/apps/academy-web/app/globals.css', 'r') as f:
    css = f.read()

# ── 2a. Remove ALL .dark { ... } blocks (including nested) ──
# Match .dark followed by optional selector parts and a brace-balanced block
def remove_dark_blocks(text):
    """Remove all .dark ... { ... } CSS rules."""
    result = []
    i = 0
    while i < len(text):
        # Look for `.dark`
        idx = text.find('.dark', i)
        if idx == -1:
            result.append(text[i:])
            break
        
        # Find the opening brace after .dark
        brace_start = text.find('{', idx)
        if brace_start == -1:
            result.append(text[i:])
            break
        
        # Check there's no semicolon between .dark and { (avoid false positives)
        between = text[idx:brace_start]
        if '\n\n' in between or ';' in between:
            result.append(text[i:idx+5])
            i = idx + 5
            continue
        
        # Find the matching closing brace
        depth = 1
        j = brace_start + 1
        while j < len(text) and depth > 0:
            if text[j] == '{':
                depth += 1
            elif text[j] == '}':
                depth -= 1
            j += 1
        
        # Append everything before .dark (strip trailing whitespace/newlines)
        before = text[i:idx]
        result.append(before.rstrip('\n'))
        result.append('\n')
        
        # Skip past the closing brace and any trailing newline
        i = j
        if i < len(text) and text[i] == '\n':
            i += 1

    return ''.join(result)

css = remove_dark_blocks(css)

# ── 2b. Fix .academy-landing variables ──
# Replace old navy-based palette with a clean cyan/indigo light palette
css = css.replace(
    '    --academy-navy: #09233f;',
    '    --academy-navy: #18181b;'
)
css = css.replace(
    '    --academy-navy-soft: #163b5f;',
    '    --academy-navy-soft: #3f3f46;'
)
css = css.replace(
    '    --academy-text: #09233f;',
    '    --academy-text: #18181b;'
)
css = css.replace(
    '    --academy-muted: #52687b;',
    '    --academy-muted: #71717a;'
)
css = css.replace(
    '    --academy-border: #d5e5e9;',
    '    --academy-border: #e4e4e7;'
)
css = css.replace(
    '    --academy-surface-soft: #eef7f8;',
    '    --academy-surface-soft: #f4f9fa;'
)
css = css.replace(
    '    --academy-canvas: #f7fbfc;',
    '    --academy-canvas: #f7f6f3;'
)
css = css.replace(
    '    --academy-header: rgb(247 251 252 / 0.92);',
    '    --academy-header: rgba(255,255,255,0.9);'
)
css = css.replace(
    '    --academy-shadow: 0 20px 60px rgb(9 35 63 / 0.1);',
    '    --academy-shadow: 0 12px 40px rgba(15,23,42,0.08);'
)

# ── 2c. Fix .academy-public-flow variables (login/register/grades pages) ──
css = css.replace(
    '    --academy-navy: #09233f;\n    --academy-navy-soft: #163b5f;\n    --academy-amber: #e99a13;\n    --academy-canvas: #f7fbfc;\n    --academy-surface: #ffffff;\n    --academy-surface-soft: #eef7f8;\n    --academy-text: #09233f;\n    --academy-muted: #52687b;\n    --academy-border: #d5e5e9;\n    --academy-header: rgb(247 251 252 / 0.92);\n    --academy-shadow: 0 20px 60px rgb(9 35 63 / 0.1);',
    '    --academy-navy: #18181b;\n    --academy-navy-soft: #3f3f46;\n    --academy-amber: #f59e0b;\n    --academy-canvas: #f7f6f3;\n    --academy-surface: #ffffff;\n    --academy-surface-soft: #f4f9fa;\n    --academy-text: #18181b;\n    --academy-muted: #71717a;\n    --academy-border: #e4e4e7;\n    --academy-header: rgba(255,255,255,0.9);\n    --academy-shadow: 0 12px 40px rgba(15,23,42,0.08);'
)

# ── 2d. Fix .academy-button — use cyan instead of navy ──
css = css.replace(
    '    border: 1px solid var(--academy-navy);\n    border-radius: 0.85rem;\n    background: var(--academy-navy);\n    color: var(--academy-surface);\n    padding: 0.65rem 1.15rem;\n    font-weight: 800;\n    line-height: 1.2;\n    box-shadow: 0 8px 22px color-mix(in srgb, var(--academy-navy) 18%, transparent);',
    '    border: 1px solid var(--academy-cyan-strong);\n    border-radius: 0.85rem;\n    background: linear-gradient(135deg, var(--academy-cyan), var(--academy-cyan-strong));\n    color: #ffffff;\n    padding: 0.65rem 1.15rem;\n    font-weight: 800;\n    line-height: 1.2;\n    box-shadow: 0 8px 22px color-mix(in srgb, var(--academy-cyan) 30%, transparent);'
)
css = css.replace(
    '    box-shadow: 0 12px 26px color-mix(in srgb, var(--academy-navy) 24%, transparent);',
    '    box-shadow: 0 12px 26px color-mix(in srgb, var(--academy-cyan) 36%, transparent);'
)

# ── 2e. Fix .academy-button-secondary hover ──
css = css.replace(
    '  .academy-button-secondary:hover {\n    background: var(--academy-surface-soft);\n    box-shadow: none;\n  }',
    '  .academy-button-secondary:hover {\n    background: var(--academy-surface-soft);\n    border-color: var(--academy-cyan);\n    color: var(--academy-cyan-strong);\n    box-shadow: none;\n  }'
)

# ── 2f. Fix skip link ──
css = css.replace(
    '    background: var(--academy-navy);\n    color: var(--academy-surface);',
    '    background: var(--academy-cyan-strong);\n    color: #ffffff;'
)

# ── 2g. Fix .academy-nav-link active color (navy → ink) ──
css = css.replace('    color: var(--academy-navy);', '    color: var(--academy-cyan-strong);')

# ── 2h. Fix student topbar (currently dark navy) ──
css = css.replace(
    '''  border-color: rgb(110 196 210 / 20%);
  background: rgb(3 25 36 / 96%);
  color: #f5fdff;
  box-shadow: 0 12px 40px rgb(2 28 40 / 12%);''',
    '''  border-color: var(--academy-border, #e4e4e7);
  background: rgba(255, 255, 255, 0.95);
  color: #18181b;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);'''
)
css = css.replace(
    '''  .student-topbar [class*='text-ink'] {
  color: rgb(229 246 249 / 72%);
}
.student-topbar button:hover {
  color: #fff;
}''',
    '''  .student-topbar [class*='text-ink'] {
  color: #71717a;
}
.student-topbar button:hover {
  color: #18181b;
}'''
)

# ── 2i. Fix student-hero (currently very dark navy gradient) ──
css = css.replace(
    '''  border: 1px solid rgb(94 221 235 / 18%);
  border-radius: clamp(1.5rem, 3vw, 2.35rem);
  background:
    radial-gradient(circle at 12% 0%, rgb(86 215 231 / 25%), transparent 22rem),
    linear-gradient(135deg, #041d29 0%, #07374a 60%, #06465a 100%);
  color: #f4fdff;
  box-shadow: 0 28px 80px rgb(3 40 55 / 18%);''',
    '''  border: 1px solid rgb(0 174 202 / 15%);
  border-radius: clamp(1.5rem, 3vw, 2.35rem);
  background:
    radial-gradient(circle at 12% 0%, rgb(0 174 202 / 12%), transparent 22rem),
    linear-gradient(135deg, #ecfcff 0%, #e0f9fc 60%, #d4f5f9 100%);
  color: #0a3d47;
  box-shadow: 0 12px 40px rgba(0, 174, 202, 0.12);'''
)

# Fix the grid overlay colors inside student-hero::before
css = css.replace(
    '''    background-image:
    linear-gradient(rgb(112 222 235 / 35%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(112 222 235 / 35%) 1px, transparent 1px);''',
    '''    background-image:
    linear-gradient(rgb(0 174 202 / 15%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(0 174 202 / 15%) 1px, transparent 1px);'''
)

# Fix student-kicker (was cyan on dark, now cyan on light)
css = css.replace(
    '''  border: 1px solid rgb(100 225 239 / 28%);
  border-radius: 999px;
  background: rgb(59 202 220 / 12%);
  padding: 0.35rem 0.75rem;
  color: #91edf5;''',
    '''  border: 1px solid rgb(0 174 202 / 30%);
  border-radius: 999px;
  background: rgb(0 174 202 / 10%);
  padding: 0.35rem 0.75rem;
  color: #007f99;'''
)

# Fix student-panel (was glass on dark, now clean white)
css = css.replace(
    '''  border: 1px solid rgb(92 176 191 / 20%);
  border-radius: 1.5rem;
  background: rgb(255 255 255 / 82%);
  box-shadow: 0 18px 55px rgb(15 64 77 / 8%);
  backdrop-filter: blur(12px);''',
    '''  border: 1px solid #e4e4e7;
  border-radius: 1.5rem;
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);'''
)

# Fix student-course-card
css = css.replace(
    '''  border: 1px solid rgb(92 176 191 / 20%);
  border-radius: 1.6rem;
  background: rgb(255 255 255 / 88%);
  box-shadow: 0 14px 45px rgb(15 64 77 / 7%);''',
    '''  border: 1px solid #e4e4e7;
  border-radius: 1.6rem;
  background: #ffffff;
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);'''
)
css = css.replace(
    '''  border-color: rgb(58 188 209 / 45%);
  box-shadow: 0 22px 60px rgb(15 64 77 / 13%);''',
    '''  border-color: rgb(0 174 202 / 40%);
  box-shadow: 0 16px 40px rgba(0, 174, 202, 0.1);'''
)

# Fix student-cover (course thumbnail placeholder - was very dark)
css = css.replace(
    '''    radial-gradient(circle at 20% 10%, rgb(84 221 234 / 28%), transparent 14rem),
    linear-gradient(135deg, #062533, #0a4255);''',
    '''    radial-gradient(circle at 20% 10%, rgb(0 174 202 / 20%), transparent 14rem),
    linear-gradient(135deg, #d4f5f9, #a8eef5);'''
)

# Fix student-app background (radial gradient was showing through dark)
css = css.replace(
    '''  background:
    radial-gradient(circle at 88% 3%, rgb(86 215 231 / 12%), transparent 25rem),
    linear-gradient(180deg, #f7fcfd 0%, #edf7f8 100%);''',
    '''  background: #f7f6f3;'''
)

# ── 2j. Fix any remaining literal navy hex values ──
css = css.replace('#09233f', '#18181b')
css = css.replace('#163b5f', '#3f3f46')
css = css.replace('#071620', '#f7f6f3')
css = css.replace('#0d202c', '#ffffff')
css = css.replace('#041d29', '#ecfcff')
css = css.replace('#07374a', '#d4f9fc')
css = css.replace('#06465a', '#c0f5fa')
css = css.replace('#062533', '#d4f5f9')
css = css.replace('#0a4255', '#a8eef5')
css = css.replace('rgb(3 25 36 / 96%)', 'rgba(255,255,255,0.95)')
css = css.replace('rgb(2 28 40 / 12%)', 'rgba(15,23,42,0.06)')
css = css.replace('rgb(3 40 55 / 18%)', 'rgba(0,174,202,0.12)')
css = css.replace('rgb(9 35 63 / 0.1)', 'rgba(15,23,42,0.08)')
css = css.replace('rgb(15 64 77 / 8%)', 'rgba(15,23,42,0.04)')
css = css.replace('rgb(15 64 77 / 7%)', 'rgba(15,23,42,0.04)')
css = css.replace('rgb(15 64 77 / 13%)', 'rgba(0,174,202,0.1)')

# ── 2k. Fix inline hex for final-card / learning sections ──
css = css.replace('color: #071620;', 'color: #18181b;')

with open('/home/deploy/bahrawy/apps/academy-web/app/globals.css', 'w') as f:
    f.write(css)
print('globals.css fixed.')

print('All done! Now rebuild the container.')
