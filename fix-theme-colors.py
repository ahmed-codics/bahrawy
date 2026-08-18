import sys

with open('/home/deploy/bahrawy/packages/ui/styles/theme.css', 'r') as f:
    content = f.read()

# Replace slate ink colors with neutral colors
content = content.replace("--color-ink: #0f172a;", "--color-ink: #171717;")
content = content.replace("--color-ink-2: #1e293b;", "--color-ink-2: #262626;")
content = content.replace("--color-ink-3: #475569;", "--color-ink-3: #525252;")
content = content.replace("--color-ink-4: #94a3b8;", "--color-ink-4: #a3a3a3;")

with open('/home/deploy/bahrawy/packages/ui/styles/theme.css', 'w') as f:
    f.write(content)

print("Theme ink colors neutralized.")
