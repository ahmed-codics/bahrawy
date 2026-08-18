import os
import glob

directory = '/home/deploy/bahrawy/apps/academy-web/app/student'

replacements = {
    'bg-white/5': 'bg-black/5',
    'bg-white/8': 'bg-black/5',
    'bg-white/10': 'bg-black/5',
    'border-white/10': 'border-black/10',
    'border-white/12': 'border-black/10',
    'border-white/20': 'border-black/10',
    'border-white/25': 'border-black/10',
    'text-cyan-50/75': 'text-ink-3',
    'text-cyan-50/60': 'text-ink-3',
    'text-cyan-50/65': 'text-ink-3',
    'text-cyan-50/70': 'text-ink-3',
    'text-cyan-100/70': 'text-ink-3',
    'text-white/65': 'text-ink-3',
    'text-cyan-200/60': 'text-brand-500/70',
    'text-cyan-300/70': 'text-brand-500/70',
    'text-cyan-200/40': 'text-brand-500/70',
    'text-cyan-200/55': 'text-brand-500/70',
}

files = glob.glob(f"{directory}/**/*.tsx", recursive=True)
count = 0

for file_path in files:
    with open(file_path, 'r') as f:
        content = f.read()
    
    modified = False
    for old, new in replacements.items():
        if old in content:
            content = content.replace(old, new)
            modified = True
            
    if modified:
        with open(file_path, 'w') as f:
            f.write(content)
        count += 1
        print(f"Updated {file_path}")

print(f"Total files updated: {count}")
