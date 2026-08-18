import os
import re

files_to_check = [
    '/home/deploy/bahrawy/apps/academy-web/app/login/page.tsx',
    '/home/deploy/bahrawy/apps/academy-web/app/register/page.tsx',
    '/home/deploy/bahrawy/apps/academy-web/app/page.tsx',
    '/home/deploy/bahrawy/apps/academy-web/components/PublicShell.tsx',
    '/home/deploy/bahrawy/packages/ui/src/components/AppShell.tsx',
    '/home/deploy/bahrawy/packages/ui/src/index.ts',
]

for filepath in files_to_check:
    if not os.path.exists(filepath):
        continue
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove `<ThemeSelector />` or `<ThemeSelector/>`
    new_content = re.sub(r'<ThemeSelector\s*/>', '', content)
    
    # Remove from imports `ThemeSelector, ` or `, ThemeSelector` or `{ ThemeSelector }`
    new_content = re.sub(r',\s*ThemeSelector\b', '', new_content)
    new_content = re.sub(r'\bThemeSelector\s*,', '', new_content)
    new_content = re.sub(r'{\s*ThemeSelector\s*}', '{}', new_content)
    
    # Clean up empty imports like `import {} from '@bahrawy/ui';`
    new_content = re.sub(r"import\s*{\s*}\s*from\s*['\"](?:@bahrawy/ui|\./ThemeSelector)['\"];?\n?", "", new_content)
    
    # Remove index.ts export
    new_content = re.sub(r"export\s*\*\s*from\s*['\"]\./components/ThemeSelector['\"];?\n?", "", new_content)
    
    # Remove import { ThemeSelector } from './ThemeSelector'; in AppShell
    new_content = re.sub(r"import\s*{\s*ThemeSelector\s*}\s*from\s*['\"]\./ThemeSelector['\"];?\n?", "", new_content)


    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

# Finally, delete ThemeSelector.tsx
ts_file = '/home/deploy/bahrawy/packages/ui/src/components/ThemeSelector.tsx'
if os.path.exists(ts_file):
    os.remove(ts_file)
    print(f"Deleted {ts_file}")

