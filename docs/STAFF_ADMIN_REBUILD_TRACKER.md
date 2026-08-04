# Staff Admin Rebuild Tracker

## Phase 0: Baseline and contracts

- [x] Fix four failing tests:
  - [x] `apps/api/src/admin-assessment/admin-assessment.controller.spec.ts` (mock AuthService for SessionAuthGuard)
  - [x] `apps/api/src/dashboard/dashboard.service.spec.ts` (mock SecurityService for DashboardService)
- [x] Define shared `AdminApiResponse<T>` and `AdminApiError` contracts in the existing shared `packages/types` package.
- [x] Produce an initial inventory of current and overlapping endpoint families.
- [ ] Expand the initial inventory to every route before removing any legacy controller.
- [x] Add backup and migration-verification scripts.
- [x] Execute the complete migration chain against disposable PGlite PostgreSQL.
- [x] Verify API typecheck passes.
- [x] Verify Staff-admin typecheck passes.
- [x] Verify full API test result with all 59 tests passing (`npm test -w api -- --runInBand`).
- [x] Verify existing staff-admin tests pass.

## Phase 1: Shared Foundations & Scaffolding

- [x] Phase 1 complete and locally verified.
- [x] **Database foundations:** Add lifecycle, scheduling, archive, version, support-message, and audit schema changes.
- [x] **Generate migrations:** Add and execute `20260719210000_phase1_foundations`.
- [x] **Repair migration chain:** Restore missing `Assessment.lessonId`, `Course.gradeId`, and `Course.descriptionAr` migration steps.
- [x] **Canonical admin API foundation:** Create `/admin/v1` modules/DTOs, standard AdminApiResponse/Error, organization scoping, optimistic versioning, permission normalization, and audit redaction.
- [x] **Shared admin UI foundation:** Build primitives (table, filter, drawer, etc.), standardize on Arabic RTL, and fix dashboard metrics contract.
- [x] **Verification:** API 64/64 tests, UI 16/16 tests, Staff Admin 1/1 test, and all relevant typechecks pass.

## Phase 2: Academic, content, and assessments

- [x] Canonical organization-scoped academic structure API.
- [x] Academic structure page for grades, subjects, years, cohorts, and terms.
- [x] Canonical course list/detail and content-tree API.
- [x] Course list with lifecycle, filters, bundle count, and readiness indicators.
- [x] Course editor loads explicit course IDs and publishes independently from children.
- [x] Preserve YouTube, R2, and Local video workflows.
- [x] Canonical reusable question-bank and assessment-assignment API.
- [x] Question-bank list, usage counts, create, archive, and restore UI.
- [x] Complete canonical mutation cutover inside every legacy course-editor child component.
- [x] Add assessment bank-selection UI to the assessment editor.
- [ ] Complete responsive visual and interaction verification.

## Phase 3: Commerce and students

- [x] Canonical products API with arbitrary course/unit membership.
- [x] Historical price changes retire active prices and create new price rows.
- [x] Replace the products page with the canonical multi-course editor and price history.
- [x] Replace student list/detail and entitlement controls.
- [x] Add canonical payment history and concurrency-safe review detail.

## Phase 4: Operations

- [x] Support conversations, internal notes, priority, status, and assignment.
- [x] Staff account, role assignment, status, and self-lockout protections.
- [x] Audit explorer and academy settings.
- [ ] Dashboard operational queues.

## Phase 5: Consolidation and launch readiness

- [x] Remove legacy API calls from rebuilt Staff Admin pages.
- [x] Restrict receipt access to authenticated accounts in the same organization.
- [x] Add focused tests for payment-review races and staff self-lockout.
- [x] Run the complete migration chain against disposable PostgreSQL.
- [x] Run API (67/67), UI (16/16), and Staff Admin (1/1) test suites and typechecks.
- [x] Verify production builds for the API and all 18 Staff Admin routes.
- [x] Fix workspace package runtime entries so the production API boots on Node 22.
- [x] Verify desktop navigation and the 390x844 mobile shell/menu without overlap.
- [x] Apply `20260719210000_phase1_foundations` to the configured remote database.
- [x] Verify authenticated live API responses through both the API and Staff Admin proxy.
- [ ] Complete live-data visual verification after the remote migration is applied.

### Deployment result

The configured Neon database is current as of July 20, 2026. The Phase 1
migration was made idempotent for a pre-existing `Course_gradeId_fkey`, verified
against disposable PGlite, and then deployed successfully. Authenticated requests
to dashboard, academic, and courses return successful responses.
