import sys
import glob

directory = '/home/deploy/bahrawy/apps/academy-web/app/student'

replacements = {
    'bg-black/5 text-white': 'bg-black/5 text-ink hover:text-ink',
    'bg-surface-soft text-text-muted hover:bg-surface-hover hover:text-text': 'bg-surface-soft text-ink-3 hover:bg-surface-3 hover:text-ink',
}

files = glob.glob(f"{directory}/**/*.tsx", recursive=True)

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
        print(f"Fixed text in {file_path}")

print("Outline buttons fixed.")
