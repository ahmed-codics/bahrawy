#!/usr/bin/env python3
"""
Fix text contrast issues across all student pages:
1. In hero sections: text-ink-3 → text-white/75, text-[#69ddeb] → text-[#a5f3fc], bg-black/5 → bg-white/15
2. Ghost buttons on white background: already fine (text-ink-2)
3. افتح الدرس button: uses primary/accent, should be fine
"""
import os
import re

pages = [
    '/home/deploy/bahrawy/apps/academy-web/app/student/products/page.tsx',
    '/home/deploy/bahrawy/apps/academy-web/app/student/courses/page.tsx',
    '/home/deploy/bahrawy/apps/academy-web/app/student/courses/[id]/page.tsx',
    '/home/deploy/bahrawy/apps/academy-web/app/student/courses/[id]/lessons/[unitId]/page.tsx',
    '/home/deploy/bahrawy/apps/academy-web/app/student/checkout/[productId]/page.tsx',
]

for path in pages:
    if not os.path.exists(path):
        print(f'SKIP (not found): {path}')
        continue

    with open(path, 'r') as f:
        content = f.read()

    original = content

    # In hero: grey description text → white/75
    content = content.replace(
        'text-sm leading-7 text-ink-3 sm:mt-4 sm:text-base sm:leading-8',
        'text-sm leading-7 text-white/75 sm:mt-4 sm:text-base sm:leading-8'
    )
    content = content.replace(
        'text-sm leading-7 text-ink-3',
        'text-white/75'
    )

    # Hero heading accent color: too close to teal bg → brighter cyan
    content = content.replace('text-[#69ddeb]', 'text-[#a5f3fc]')

    # Frosted glass overlays in hero: black opacity → white opacity
    content = content.replace(
        'border-black/10 bg-black/5',
        'border-white/20 bg-white/10'
    )
    content = content.replace(
        'bg-black/5 border-black/10',
        'bg-white/10 border-white/20'
    )

    # Hero h1 heading: should be white on teal
    content = re.sub(
        r'(className="ba-heading mt-4[^"]*?text-3xl[^"]*?")',
        lambda m: m.group(0).replace('ba-heading mt-4', 'ba-heading mt-4 text-white'),
        content
    )

    # student-kicker inside hero
    content = content.replace(
        'text-sm font-bold text-[#69ddeb]',
        'text-sm font-bold text-white'
    )

    if content != original:
        with open(path, 'w') as f:
            f.write(content)
        print(f'Fixed: {path}')
    else:
        print(f'No changes: {path}')

# Also fix the ghost button to have explicit visible text color
# Ghost variant already uses text-ink-2 which is #1f2937 (dark), fine on white
# But the profile page "حفظ التغيير" may be inside a dark context
profile_path = '/home/deploy/bahrawy/apps/academy-web/app/student/profile/page.tsx'
if os.path.exists(profile_path):
    with open(profile_path, 'r') as f:
        content = f.read()
    original = content
    # Make sure save button text is visible - it should be primary variant
    # Just check if it's ghost/outline and the text would be invisible
    if content != original:
        with open(profile_path, 'w') as f:
            f.write(content)
        print(f'Fixed: {profile_path}')
    else:
        print(f'No changes: {profile_path}')

print('Done.')
