# Bahrawy Academy — Master Design System

This document is the visual source of truth for both academy applications. It reconciles the UI UX Pro Max audit with the Arabic-first product specification. Generated recommendations aimed at young children, app-store downloads, Comic Neue/Baloo, and teal-only branding were intentionally rejected because the audience is Egyptian Third Secondary students and the product is a teacher-led web academy.

## Identity

- Style: premium youth gamified; energetic, trustworthy, and mature rather than childish.
- Visual motif: crisp color blocks, notebook grids, progress paths, and restrained achievement moments.
- Never use structural emoji, fake testimonials, fake teacher photography, random glass panels, or gradients on every surface.
- Real teacher photography must fit the reserved hero frame without requiring layout changes.

## Tokens

| Role              | Light                 | Dark      |
| ----------------- | --------------------- | --------- |
| Canvas            | `#F5F8FC`             | `#06101E` |
| Surface           | `#FFFFFF`             | `#0D1B2A` |
| Ink/Navy          | `#071426` / `#0A2240` | `#F3F8FC` |
| Electric blue     | `#2563EB`             | `#5C9BFB` |
| Nile cyan         | `#00B8E6`             | `#43CDFC` |
| Achievement amber | `#FFB000`             | `#FFC247` |
| Challenge coral   | `#FF5C77`             | `#FF8CA0` |
| Assessment violet | `#7357F6`             | `#A997FF` |

Use semantic variables from `packages/ui/styles/theme.css`; do not place new raw hex colors in page components.

## Typography and icons

- Arabic display: Alexandria Variable, 700–900.
- Arabic body/UI: Noto Sans Arabic Variable, 400–700, minimum 16px for primary mobile text.
- English/LTR/numbers: Manrope Variable with tabular figures for prices, timers, codes, and metrics.
- Arabic body line-height: 1.6. Long text measure: maximum 65–75 characters.
- Lucide is the single icon family. Standard UI icons are 20px with consistent 2px strokes.

## Components and layout

- Controls are at least 44px high and use the shared focus ring.
- Cards use crisp opaque surfaces, the shared border, 20px radius, and the three-level shadow scale.
- Learner mobile navigation contains no more than five labeled destinations; desktop uses the learner sidebar.
- Staff uses a denser collapsible sidebar, operational page headers, responsive tables/cards, and one primary action per page.
- Every network view needs skeleton, empty, error, disabled, loading, and success states as applicable.

## Motion

- Micro-interactions: 140–260ms, transform/opacity only.
- Maximum one or two animated groups per view. Use stagger intervals of 40ms.
- Lesson/video pages avoid decorative motion.
- `prefers-reduced-motion` and data-saver are mandatory.

## QA

- Check 360, 768, 1024, and 1440px widths in light and dark modes.
- No horizontal overflow, hidden fixed-nav content, unlabeled icon buttons, color-only states, or dead controls.
- Normal text contrast must reach 4.5:1; interactive glyphs and large text must reach 3:1.
