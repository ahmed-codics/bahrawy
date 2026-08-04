# Bahrawy Academy UI/UX Guide

The implementation source of truth is `design-system/bahrawy-academy/MASTER.md`. Shared tokens and components live in `packages/ui` and must be reused by both Next.js applications.

## Experience rules

- Arabic-first RTL with isolated English/LTR content.
- The student product answers four questions immediately: what is next, how far have I progressed, what needs action, and where can I get help.
- Public pages are conversion-focused and teacher-led. Student pages are motivating and calm. Staff pages are dense and operational.
- Use real API data. Do not add mock results, fake reviews, dead buttons, or decorative content presented as fact.
- New pages should start with `PageHeader`, use `PageSkeleton` while loading, and provide `EmptyState` or `ErrorState` where required.

## Component selection

- `LearnerShell`: student and guardian navigation.
- `StaffShell`: authenticated operations portal.
- `Button`, `Input`, `Select`, `Textarea`: all forms and actions.
- `Badge`: statuses with icon/text, never color alone.
- `ProgressBar`, `StatCard`: progress and dashboard metrics.
- `PageIntro`, `StaggerGrid`: restrained motion that automatically respects reduced-motion preferences.

## Review checklist

1. Existing API request and response shapes are unchanged.
2. The route remains usable with keyboard, touch, reduced motion, dark mode, and 360px width.
3. Loading actions cannot be submitted twice.
4. Errors explain recovery; empty states suggest a useful next step.
5. Internal navigation uses real routes and no visible action is inert.
