# Requirement Traceability Matrix

| Requirement          | Implementation Files                                        | Tests                                   | Status      | Evidence / SHA |
| -------------------- | ----------------------------------------------------------- | --------------------------------------- | ----------- | -------------- |
| M1: Monorepo Config  | `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json` | -                                       | In Progress | -              |
| M1: Local Compose    | `docker-compose.yml`                                        | `pnpm compose:validate`                 | In Progress | -              |
| M1: Env Validation   | `packages/config/index.ts`                                  | `packages/config/index.spec.ts`         | In Progress | -              |
| M1: CI Pipeline      | `.github/workflows/ci.yml`                                  | CI execution                            | In Progress | -              |
| M2: Shared UI Pkg    | `packages/ui/src/index.ts`, `components/`                   | `packages/ui/src/components/*.spec.tsx` | In Progress | -              |
| M2: Tailwind tokens  | `packages/ui/styles/theme.css`                              | visual                                  | In Progress | -              |
| M2: Arabic RTL Shell | `apps/academy-web/app/layout.tsx`, `page.tsx`               | `apps/academy-web/test/page.spec.tsx`   | In Progress | -              |
| M2: Staff RTL Shell  | `apps/staff-admin/app/layout.tsx`, `page.tsx`               | `apps/staff-admin/test/page.spec.tsx`   | In Progress | -              |

_This matrix will be populated iteratively as milestones are completed._
