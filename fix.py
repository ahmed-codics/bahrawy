import sys
import re

with open('/home/deploy/bahrawy/apps/academy-web/app/globals.css', 'r') as f:
    content = f.read()

# Fix the broken part at academy-course-filter
broken_part = """  .academy-course-filter {
    display: grid;
    grid-template-columns: 11rem minmax(0, 1fr);
    align-items: center;
    gap: 1.25rem;
    border: 1px solid var(--academy-border);
    border-radius: 1.15rem;
    background: var(--academy-surface);
    padding: 1rem;
    .academy-learning-card {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 1.5rem;
    background: var(--academy-surface);
    padding: 2.2rem 2.2rem 2.6rem;
    box-shadow: 0 12px 32px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -4px rgba(15, 23, 42, 0.04);
    border: 1px solid var(--academy-border);
    transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .academy-learning-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 48px -8px rgba(15, 23, 42, 0.12), 0 8px 24px -8px rgba(15, 23, 42, 0.06);
  } box-shadow: 0 10px 35px color-mix(in srgb, var(--academy-navy) 6%, transparent);
  }"""

fixed_part = """  .academy-course-filter {
    display: grid;
    grid-template-columns: 11rem minmax(0, 1fr);
    align-items: center;
    gap: 1.25rem;
    border: 1px solid var(--academy-border);
    border-radius: 1.15rem;
    background: var(--academy-surface);
    padding: 1rem;
    box-shadow: 0 10px 35px color-mix(in srgb, var(--academy-navy) 6%, transparent);
  }"""

if broken_part in content:
    content = content.replace(broken_part, fixed_part)
    print("Fixed broken part")
else:
    print("Broken part not found exactly")

# Now properly update .academy-learning-card
old_card = """  .academy-learning-card {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 1.5rem;
    background: var(--academy-surface);
    padding: 2.2rem 2.2rem 2.6rem;
    box-shadow: 0 8px 24px color-mix(in srgb, var(--academy-navy) 4%, transparent);
    transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }"""

new_card = """  .academy-learning-card {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 1.5rem;
    background: var(--academy-surface);
    padding: 2.2rem 2.2rem 2.6rem;
    box-shadow: 0 12px 32px -4px rgba(15, 23, 42, 0.08), 0 4px 12px -4px rgba(15, 23, 42, 0.04);
    border: 1px solid var(--academy-border);
    transition: transform 300ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .academy-learning-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 48px -8px rgba(15, 23, 42, 0.12), 0 8px 24px -8px rgba(15, 23, 42, 0.06);
  }"""

content = content.replace(old_card, new_card)

with open('/home/deploy/bahrawy/apps/academy-web/app/globals.css', 'w') as f:
    f.write(content)

