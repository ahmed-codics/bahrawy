# Bahrawy Staff Admin Rebuild Plan

## 1. Objective

Rebuild the staff portal as a reliable Arabic RTL operations console covering:

- Academic structure
- Courses, chapters, lessons, videos, files, and assessments
- Products, bundles, and prices
- Question bank and assessment assignment
- Students, access, devices, and progress
- Payments and financial history
- Support tickets
- Staff accounts and permissions
- Audit history and academy settings

The admin must use real API data, expose every supported operation clearly, and never
show a successful empty state when a request has failed.

Implementation must be phased so the current academy remains usable while individual
admin modules are replaced.

## 2. Confirmed Product Decisions

- The interface is Arabic-first and RTL.
- Codes, IDs, phone numbers, prices, and provider names remain LTR.
- Deletion archives records by default.
- Permanent deletion is restricted to unused records and requires elevated permission.
- Content and products support immediate publication, scheduled publication, and
  optional automatic expiration.
- All scheduling uses the `Africa/Cairo` timezone.
- Publishing a course does not publish its draft lessons.
- Child content keeps its own publication state.
- A separate reviewed bulk action can publish all ready descendants.
- Bundles may contain any number of full courses and selected lessons.
- Individual lessons may also be sold separately.
- Staff may grant, extend, suspend, expire, or revoke student entitlements with a reason
  and audit trail.

## 3. Current Audit Findings

### Dashboard

- The UI expects `stats`, but the API returns `metrics`, so counters display zero.
- The API does not currently return `activeCourses`.
- Dashboard failures can redirect to login instead of showing a recoverable error.
- Quick actions navigate to list pages but do not open the requested creation workflow.

### Courses and content

- The courses page displays academic levels rather than a real course-management list.
- The course detail route ambiguously accepts either a course ID or grade ID.
- Grades can be listed but cannot be created, edited, reordered, or archived.
- Course editing is incomplete.
- Courses, chapters, units, and lessons are created as published by default.
- Publishing a course currently publishes every descendant recursively.
- Chapter and unit deletion can permanently cascade through lessons and content.
- Video state is visible only after opening a course and is not summarized in lists.
- Content readiness is not calculated.
- Lesson status, schedule, file state, provider, and assessment state are scattered across
  separate cards.
- Reordering APIs exist in places but are not exposed consistently.
- Duplicate catalog/content controllers implement overlapping behavior.

### Products and prices

- The database supports multiple courses per product, but the create form accepts one.
- The database returns `ProductCourse` wrappers while the UI expects direct courses.
- Existing products cannot be fully edited, archived, restored, or scheduled.
- Prices are overwritten instead of being treated as historical versions.
- The UI does not explain how product changes affect existing entitlements.

### Question bank and assessments

- Question creation inserts placeholder options and offers only minimal fields.
- Bank questions cannot be selected and attached to an existing assessment.
- Assessment screens create new questions instead of reusing bank questions.
- Questions cannot be searched, filtered, tagged, duplicated, archived, or restored.
- Deleting an assessment question may delete the underlying bank question.
- Question usage count is not shown.
- Assessment APIs are duplicated across multiple controllers.

### Students

- Student creation omits `gradeId`.
- New students can therefore disappear from grade-filtered lists.
- The current student list uses a separate API from the more capable student controller.
- Student detail shows mocked enrollment content.
- Suspension, reinstatement, device revocation, enrollments, and payments exist partly in
  the API but are not exposed in the UI.
- Student creation uses a shared `student_secret` password, contrary to the documented
  one-use activation policy.
- Search and pagination are performed inconsistently.
- Phone numbers may appear as `HIDDEN` without the UI explaining why.

### Payments

- The page loads only the pending review queue.
- Approved and rejected historical payments cannot be viewed.
- The current database contains historical payments that the page does not expose.
- Rejection uses a generic hard-coded note instead of requiring a reason.
- Receipt, reviewer, review timestamp, ledger entry, and resulting entitlement are not
  presented together.
- Duplicate payment controllers expose overlapping routes.

### Support

- Replies are appended to the ticket description as text.
- There is no message model, conversation timeline, assignment, priority, or unread state.
- A staff reply automatically resolves the ticket.
- Tickets cannot be reopened, reassigned, prioritized, or placed in progress.

### Permissions, auditing, and reliability

- Permission naming is inconsistent between seeded uppercase permissions and lowercase
  route requirements.
- The owner bypass hides these permission mismatches during development.
- Most request bodies use `any` instead of validated DTOs.
- Audit records frequently use `targetId: UNKNOWN`.
- The generic audit interceptor can store sensitive request and response bodies.
- Organization ownership is not consistently validated in database queries.
- There is almost no staff UI test coverage.
- The current API test baseline has four failing tests caused by missing test dependencies.

## 4. Target Information Architecture

The staff navigation must contain:

1. Overview
2. Academic structure
3. Courses and content
4. Products and pricing
5. Question bank and assessments
6. Students
7. Payments
8. Support
9. Staff and permissions
10. Audit log
11. Academy settings

The global grade selector must be removed from pages that are not grade-specific.
Courses, questions, products, and students receive explicit page filters instead.

## 5. UX and Design Requirements

- Use the existing `@bahrawy/ui` package and design tokens.
- Build a dense operational interface rather than a card-heavy marketing layout.
- Prefer searchable data tables for entity lists.
- Tables require sticky headers, pagination, sorting, filters, row menus, and bulk
  selection where applicable.
- Use side drawers or dedicated detail pages for large edit forms.
- Use dialogs only for confirmations and compact actions.
- Show lifecycle state using text and icons, never color alone.
- Use contextual creation actions instead of the generic `New` button.
- Add unsaved-change protection to editors.
- Disable mutation controls and show progress while requests are running.
- Show field-level validation messages.
- Show success feedback after every mutation.
- API failures must render an error state with a retry action, not an empty state.
- All destructive actions require a confirmation that names the affected record.
- Archive and permanent-delete actions must be visually and permission-wise distinct.
- Support keyboard navigation and visible focus states.
- Interactive targets must be at least 44 by 44 pixels on touch layouts.
- Validate light mode, dark mode, reduced motion, and widths of 360, 768, 1024, and
  1440 pixels.

## 6. API Consolidation

Create a canonical versioned staff API under:

```text
/admin/v1/dashboard
/admin/v1/academic/*
/admin/v1/courses/*
/admin/v1/content/*
/admin/v1/products/*
/admin/v1/questions/*
/admin/v1/assessments/*
/admin/v1/students/*
/admin/v1/payments/*
/admin/v1/support/*
/admin/v1/staff/*
/admin/v1/audit/*
/admin/v1/settings/*
```

During phased migration, existing routes may delegate to the new services. Remove the
legacy `/staff`, `/dashboard/staff`, `/payment`, and duplicate admin routes only after all
frontends and tests use `/admin/v1`.

### Response contract

Successful responses:

```ts
type AdminApiResponse<T> = {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    nextCursor?: string | null;
  };
  message?: string;
};
```

Errors:

```ts
type AdminApiError = {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
  traceId: string;
};
```

### API rules

- Every body and query uses a validated DTO.
- Every query is scoped by the authenticated organization.
- List endpoints support server pagination, search, filters, and stable sorting.
- Mutations that edit existing records require `version`.
- Version conflicts return `409 CONFLICT`.
- Financial commands and retryable creation commands require idempotency keys.
- Multi-record mutations use database transactions.
- Mutation services emit explicit audit records.
- Controllers must not directly access Prisma.

## 7. Lifecycle and Scheduling Model

Use persisted lifecycle values:

```text
DRAFT
PUBLISHED
ARCHIVED
```

Publishing entities receive:

```text
publishAt    DateTime?
unpublishAt  DateTime?
archivedAt   DateTime?
version      Int
```

The API derives:

```text
DRAFT
SCHEDULED
LIVE
EXPIRED
ARCHIVED
```

Learner visibility requires:

- The entity is `PUBLISHED`.
- `publishAt` is empty or in the past.
- `unpublishAt` is empty or in the future.
- Every required parent is effectively live.

A course publication command changes only the course. It must never alter child states
unless staff explicitly invokes a separate bulk-publish command.

No cron job is required for basic visibility. Queries calculate effective state using the
current time. Use the worker/outbox only for scheduled notifications and asynchronous
side effects.

## 8. Database Changes

### Academic and content

- Add optional `subjectId` and `termId` relationships to courses.
- Validate that a selected term belongs to the course grade/cohort.
- Add publication fields and `version` where missing on courses, chapters, units,
  lessons, assessments, products, and other publishable entities.
- Normalize the course Arabic description field as `descriptionAr`.
- Preserve existing description data during migration.
- Add archive metadata to questions.
- Add appropriate indexes for status, publication windows, grade, subject, term, and
  list sorting.

### Products and prices

- Migrate product `ACTIVE` records to `PUBLISHED`.
- Preserve `ProductCourse` and `ProductUnit` as the product membership relations.
- Treat full-course and selected-lesson membership as explicit editor sections.
- Make prices historical: changing a price retires the old active price and creates a new
  price record.
- Do not mutate financial history to match later price changes.

### Support

Create `SupportMessage` with:

```text
id
ticketId
authorAccountId
authorKind
body
isInternal
createdAt
```

Extend `SupportTicket` with:

```text
priority
assignedStaffId
lastMessageAt
studentUnreadAt
staffUnreadAt
resolvedAt
closedAt
version
```

Support statuses:

```text
OPEN
IN_PROGRESS
WAITING_FOR_STUDENT
RESOLVED
CLOSED
```

### Audit

Audit records must contain:

```text
actorId
action
targetType
targetId
before
after
reason
traceId
createdAt
```

Passwords, activation codes, recovery codes, tokens, cookies, secrets, file contents,
and encrypted personal data must always be redacted.

## 9. Page Specifications

### 9.1 Overview

Show:

- Active and suspended students
- Pending payments
- Payments reviewed today
- Live, scheduled, and draft courses
- Lessons missing video, PDF, or assessment requirements
- Open and overdue support tickets
- Failed or incomplete uploads
- Releases scheduled in the next seven days

Every metric links to the corresponding pre-filtered page.

### 9.2 Academic structure

Provide CRUD, ordering, activation, and archiving for:

- Academic years
- Grades/academic levels
- Subjects
- Cohorts
- Terms

Validate date ranges and prevent archiving without warning when active courses or students
reference the record.

### 9.3 Courses list

Display:

- Course title and code
- Grade
- Subject
- Term
- Lifecycle and effective publication state
- Publication window
- Number of chapters and lessons
- Number of bundles
- Video readiness
- PDF readiness
- Assessment readiness
- Last update

Actions:

- Create
- Edit
- Duplicate
- Preview as student
- Publish or schedule
- Unpublish
- Archive
- Restore
- Bulk publish ready content

### 9.4 Course editor

Use an outline tree for chapters, units, and lessons with a detail workspace for the
selected item.

Support:

- Add, rename, move, reorder, duplicate, archive, and restore
- Independent lifecycle and schedule controls
- Course and assessment prerequisites
- Readiness validation before publication
- Unsaved-change warnings
- Student preview

Each lesson must clearly show:

- Video present or missing
- Provider: YouTube, R2, or Local
- Source identifier or original filename
- Upload/processing status
- File size and duration when available
- Attached PDF state
- Assessment state and question count
- Lifecycle and publication schedule

Keep the existing R2 direct-upload, YouTube embed, and local development workflows.

### 9.5 Products and pricing

The product list shows status, schedule, active price, included courses, selected lessons,
student entitlement count, and last update.

The product editor supports:

- Basic information and cover
- Any number of courses
- Any number of selected lessons
- Standalone lesson products
- Price amount, currency, and billing period
- Draft, scheduled, live, expired, and archived states
- Preview of exactly what students receive

Removing content must warn about active entitlements. Existing access remains unchanged
unless staff performs a separate entitlement correction.

### 9.6 Question bank

Provide:

- Search
- Grade, subject, type, tag, status, and usage filters
- Complete question editor
- Answer options and correct answer
- Passage, image, explanation, points, and tags
- Edit, duplicate, archive, restore, and bulk tagging
- Usage count with links to assessments

“Assign to lesson” opens:

```text
Course -> Unit/Lesson -> Existing assessment or New assessment
```

The selected bank question is linked through `AssessmentQuestion`; it is not copied.

### 9.7 Assessment builder

Support:

- Lesson and unit assessments
- Homework and quiz types
- Search and select existing bank questions
- Create a bank question without leaving the builder
- Unlink without deleting the bank question
- Reorder questions
- Passing score
- Attempt limit
- Duration
- Shuffle
- Result release rule
- Lifecycle and schedule
- Student preview

### 9.8 Students list

Use one canonical paginated endpoint.

Filters:

- All grades by default
- Grade
- Account status
- Entitlement/product
- Activation state
- Device count
- Search by name or normalized phone

Student creation requires name, phone, and grade. It issues a one-use activation
credential and never exposes or assigns a shared permanent password.

### 9.9 Student detail

Tabs:

- Overview
- Access and entitlements
- Courses and progress
- Payments
- Devices and sessions
- Guardians
- Security and recovery
- Audit history

Actions:

- Edit profile and grade
- Suspend or reinstate
- Revoke one device
- Revoke all sessions
- Start an audited recovery case
- Grant product access
- Extend or set expiration
- Suspend, expire, or revoke entitlement

Every access-changing action requires a reason.

### 9.10 Payments

Views:

- Pending
- Approved
- Rejected
- All

Filters:

- Date range
- Student
- Product
- Status
- Reviewer
- Amount range

The payment detail shows:

- Student and product
- Requested amount and price
- Receipt preview
- Submission time
- Reviewer and review time
- Review note
- Ledger entry
- Resulting entitlement
- Audit timeline

Rejection requires a reason. Review commands must be transactional and idempotent.
Payment and ledger records are immutable. Add CSV export for the active filters.

### 9.11 Support

The support table shows priority, status, assignee, student, last message, unread state,
and age.

The detail page provides:

- Conversation timeline
- Staff replies
- Internal notes
- Assignment
- Priority
- Status transitions
- Reopen and close controls

A staff reply must not automatically resolve a ticket unless staff selects that outcome.

### 9.12 Staff and permissions

Provide:

- Staff invitation and one-use activation
- Staff suspension and reinstatement
- Role assignment
- Optional branch scope
- TOTP enrollment status
- Session revocation

Use canonical permissions:

```text
CATALOG_MANAGE
PRODUCT_MANAGE
STUDENT_MANAGE
PAYMENT_MANAGE
SUPPORT_MANAGE
STAFF_MANAGE
ASSESSMENT_MANAGE
AUDIT_VIEW
SETTINGS_MANAGE
```

Navigation, UI actions, and API authorization must use the same permission codes.

### 9.13 Audit log

Provide a read-only explorer with:

- Actor
- Action
- Target
- Date
- Reason
- Trace ID
- Before/after diff

Audit entries cannot be edited or deleted through the admin.

### 9.14 Academy settings

Manage:

- Academy display information
- Timezone
- Currency
- Academic defaults
- Video provider availability
- R2/local storage health
- Upload limits

Never display API secrets, access keys, or secret tokens.

## 10. Data Migration

1. Take a verified database backup before applying migrations.
2. Add new nullable fields and models first.
3. Backfill existing product `ACTIVE` statuses to `PUBLISHED`.
4. Backfill publication dates without changing current learner visibility.
5. Copy existing course descriptions into `descriptionAr`.
6. Preserve all YouTube, R2, and Local `VideoLesson` records.
7. Preserve all `ProductCourse`, `ProductUnit`, entitlement, payment, and ledger records.
8. Import each existing support description as a legacy transcript message.
9. Preserve existing assessment-question links.
10. Add constraints only after backfill validation succeeds.
11. Verify row counts and relationship counts before switching APIs.

## 11. Implementation Phases

### Phase 0: Baseline and contracts

- Fix the four currently failing API tests.
- Add this document to implementation tracking.
- Define shared API response/error types.
- Inventory and freeze legacy endpoint behavior.
- Add database backup and migration verification scripts.

### Phase 1: Foundations

- Add lifecycle, scheduling, archive, version, support-message, and audit schema changes.
- Implement canonical `/admin/v1` modules and DTO validation.
- Add organization scoping and permission normalization.
- Build shared table, filter bar, drawer, status, confirmation, and error components.
- Correct the staff shell and dashboard metric contract.

### Phase 2: Academic, content, and assessments

- Build academic structure management.
- Replace the course list and course editor.
- Add readiness calculations and publishing controls.
- Preserve and integrate all video providers.
- Rebuild question bank and assessment assignment.

### Phase 3: Commerce and students

- Rebuild products and historical pricing.
- Add full payment history and review detail.
- Replace student list/detail and secure activation.
- Add entitlement and device/session controls.

### Phase 4: Operations

- Replace support with real conversations.
- Add staff and permission management.
- Add audit explorer and academy settings.
- Complete dashboard operational queues.

### Phase 5: Cutover

- Run migration and parity tests against a production-like backup.
- Switch each page to its canonical endpoint.
- Monitor errors and audit output.
- Remove compatibility endpoints only after all consumers and tests pass.

## 12. Testing Requirements

### Unit tests

- Lifecycle and effective-state calculation
- Cairo-time scheduling boundaries
- Archive and permanent-delete rules
- Content readiness
- Product membership validation
- Price versioning
- Entitlement transitions
- Payment review idempotency
- Permission evaluation
- Audit redaction

### API integration tests

- Every CRUD command
- Search, filter, sorting, and pagination
- Organization and branch boundaries
- Unauthorized and insufficient-role access
- Invalid parent relationships
- Optimistic concurrency conflicts
- Payment and entitlement transactions
- Question reuse across assessments
- Support status transitions

### Migration tests

- Empty database migration
- Current seeded database migration
- Production-like backup migration
- Row-count and relationship parity
- Rollback rehearsal before deployment

### Staff UI tests

- Loading, error, empty, populated, and permission-denied states
- Form validation and duplicate-submission prevention
- Archive, restore, and permanent-delete confirmations
- Filters and pagination
- Unsaved-change protection
- Correct permission-based navigation and actions

### End-to-end journeys

- Create academic level, subject, term, and course
- Build and reorder course content
- Add YouTube, R2, and Local videos
- Schedule course and lesson publication
- Create a multi-course bundle
- Create and reuse a bank question in a lesson assessment
- Create and activate a student
- Suspend and reinstate a student
- Grant and revoke entitlement
- Review a payment and view it in history
- Create, reply to, resolve, reopen, and close a support ticket
- Invite staff and verify role restrictions

### Visual and accessibility tests

- Arabic RTL at 360, 768, 1024, and 1440 pixels
- Light and dark modes
- Keyboard-only navigation
- Visible focus
- Reduced motion
- No horizontal overflow
- No text or control overlap
- WCAG AA contrast

## 13. Acceptance Criteria

- Every visible action is implemented and functional.
- No API error is presented as an empty data state.
- Existing students, historical payments, questions, videos, products, and support tickets
  remain accessible after migration.
- Course and lesson publication are independent.
- Scheduled content becomes visible and expires at the configured Cairo time.
- Course lists clearly identify missing and uploaded video content.
- Bundles accept multiple courses and selected lessons.
- Questions can be reused and assigned to lesson assessments.
- Students can be suspended, reinstated, and managed from their profile.
- Past payments are searchable and review details are retained.
- Every financial, access, publishing, permission, and destructive mutation creates a
  redacted audit event.
- Typecheck, unit, integration, migration, E2E, accessibility, and responsive visual tests
  pass before legacy endpoints are removed.

## 14. Implementation Guardrails

- Preserve unrelated existing work and the current video-provider implementation.
- Do not use mock data or placeholder admin results.
- Do not expose permanent passwords or infrastructure secrets.
- Do not hard-delete financial, progress, entitlement, support, or audit history.
- Do not introduce a second state-management framework unless existing React patterns are
  demonstrably insufficient.
- Keep business rules in API/domain services, not React components or controllers.
- Prefer explicit transactional commands over generic CRUD for high-risk operations.
- Update this document after every phase with completed items, migration identifiers,
  test evidence, and known follow-up work.
