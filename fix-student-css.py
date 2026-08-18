import sys

with open('/home/deploy/bahrawy/apps/academy-web/app/globals.css', 'r') as f:
    content = f.read()

# student-hero styles
old_student_hero = """  .student-hero {
    position: relative;
    z-index: 1;
    overflow: hidden;
    background:
      linear-gradient(rgba(23, 23, 23, 0.4), rgba(23, 23, 23, 0.4)),
      var(--student-navy);
    padding: 3rem 1.25rem 4rem;
  }"""
new_student_hero = """  .student-hero {
    position: relative;
    z-index: 1;
    overflow: hidden;
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, var(--academy-cyan-soft) 70%, transparent) 1px,
        transparent 1px
      ),
      linear-gradient(
        color-mix(in srgb, var(--academy-cyan-soft) 70%, transparent) 1px,
        transparent 1px
      ),
      var(--academy-canvas);
    background-size: 48px 48px;
    padding: 3rem 1.25rem 4rem;
  }"""
if old_student_hero in content:
    content = content.replace(old_student_hero, new_student_hero)

old_hero_before = """  .student-hero::before {
    position: absolute;
    z-index: -1;
    inset: auto auto -10rem -10rem;
    width: 32rem;
    height: 32rem;
    border-radius: 50%;
    background: radial-gradient(
      color-mix(in srgb, var(--student-cyan) 8%, transparent),
      transparent 70%
    );
    content: '';
  }"""
new_hero_before = """  .student-hero::before {
    position: absolute;
    z-index: -1;
    inset: auto auto -10rem -10rem;
    width: 32rem;
    height: 32rem;
    border-radius: 50%;
    background: radial-gradient(
      color-mix(in srgb, var(--academy-cyan) 8%, transparent),
      transparent 70%
    );
    content: '';
  }"""
if old_hero_before in content:
    content = content.replace(old_hero_before, new_hero_before)


# student-panel styles
old_student_panel = """  .student-panel {
    border-radius: 1.25rem;
    background: var(--student-navy);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2);
  }"""
new_student_panel = """  .student-panel {
    border-radius: 1.25rem;
    background: var(--academy-surface);
    border: 1px solid var(--academy-border);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02);
  }"""
if old_student_panel in content:
    content = content.replace(old_student_panel, new_student_panel)

# student-course-card styles
old_course_card = """  .student-course-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 1.15rem;
    background: var(--student-navy-2);
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.15);
    transition:
      transform 200ms ease-out,
      box-shadow 200ms ease-out,
      background-color 200ms ease-out;
  }"""
new_course_card = """  .student-course-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 1.15rem;
    background: var(--academy-surface);
    border: 1px solid var(--academy-border);
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03), 0 1px 3px rgba(15, 23, 42, 0.02);
    transition:
      transform 250ms cubic-bezier(0.16, 1, 0.3, 1),
      border-color 250ms ease-out,
      box-shadow 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }"""
if old_course_card in content:
    content = content.replace(old_course_card, new_course_card)

old_course_card_hover = """  .student-course-card:hover {
    transform: translateY(-4px);
    background: color-mix(in srgb, var(--student-navy-2) 80%, white);
    box-shadow: 0 16px 36px rgba(0, 0, 0, 0.25);
  }"""
new_course_card_hover = """  .student-course-card:hover {
    transform: translateY(-4px);
    border-color: color-mix(in srgb, var(--academy-cyan) 40%, var(--academy-border));
    box-shadow: 0 20px 48px -8px rgba(15, 23, 42, 0.12), 0 8px 24px -8px rgba(15, 23, 42, 0.06);
  }"""
if old_course_card_hover in content:
    content = content.replace(old_course_card_hover, new_course_card_hover)

with open('/home/deploy/bahrawy/apps/academy-web/app/globals.css', 'w') as f:
    f.write(content)

print("CSS updated successfully.")
