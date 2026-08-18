import sys

with open('/home/deploy/bahrawy/apps/academy-web/app/globals.css', 'r') as f:
    content = f.read()

# Fix the broken CSS around academy-public-flow
broken_css = """    min-height: 100dvh;
    background: var(--academy-canvas);
    color: var(--academy-text);
  }
    --academy-header: rgb(7 22 32 / 0.92);
    --academy-shadow: 0 20px 60px rgb(0 0 0 / 0.28);
  }"""

fixed_css = """    min-height: 100dvh;
    background: var(--academy-canvas);
    color: var(--academy-text);
  }"""

if broken_css in content:
    content = content.replace(broken_css, fixed_css)
    print("Fixed broken CSS block.")

# Replace slate colors with neutral colors for navy variables
# to completely remove the 'dark blue' feel.
# Slate 900: #0f172a -> Neutral 900: #171717
# Slate 800: #1e293b -> Neutral 800: #262626
# Slate 500: #64748b -> Neutral 500: #737373
content = content.replace("--academy-navy: #0f172a;", "--academy-navy: #171717;")
content = content.replace("--academy-navy-soft: #1e293b;", "--academy-navy-soft: #262626;")
content = content.replace("--academy-text: #0f172a;", "--academy-text: #171717;")
content = content.replace("--academy-text: #1e293b;", "--academy-text: #262626;")
content = content.replace("--academy-muted: #64748b;", "--academy-muted: #737373;")

# And student-navy around 1345
content = content.replace("--student-navy: #041d29;", "--student-navy: #171717;")
content = content.replace("--student-navy-2: #073247;", "--student-navy-2: #262626;")

with open('/home/deploy/bahrawy/apps/academy-web/app/globals.css', 'w') as f:
    f.write(content)

print("Colors neutralized.")
