# Bahrawy Academy — Master Product & Implementation Specification

> **Canonical brand:** Bahrawy Academy / أكاديمية البحراوي  
> **Teacher brand:** Mr. Bahrawy / مستر البحراوي  
> **Document status:** Decision-complete implementation contract — Version 1.1 Lean V1  
> **Prepared:** 14 July 2026  
> **Public-core deadline:** 31 July 2026  
> **Launch cohort:** Egyptian 2026/27 Third Secondary English students  
> **Product locale:** Arabic-first, right-to-left; English educational content  
> **Operational timezone:** `Africa/Cairo`  
> **Currency:** Egyptian pound (`EGP`)  
> **Primary implementer:** Antigravity  
> **Document owner:** Bahrawy Academy

---

## Instructions to Antigravity

This document is the delivery contract, not a brainstorming brief. Implement the behavior, boundaries, states, permissions, and acceptance criteria as written. Do not silently reinterpret a requirement, substitute an easier flow, expose an unfinished feature, or leave a decision to the end user or future implementer.

Use these rules while implementing:

1. **Treat “must” as mandatory.** “Should” denotes a strong default that may change only when a documented technical constraint makes the specified behavior impossible. “May” is optional.
2. **Prefer this specification over the initial requirements note.** The source note expressed the first product idea; the decisions in this document reconcile and supersede its contradictions.
3. **Do not invent launch scope.** Native apps, live classes, offline video, casting, captions, audio questions, certificates, Google login, automated Paymob, and leaderboards are not launch features unless a later signed change explicitly promotes them.
4. **Do not expose partial work.** Added July targets are independently feature-flagged. A disabled module must be absent from navigation, dashboards, search, direct routes, public copy, and API access—not shown as a dead “coming soon” screen.
5. **Build future-capable foundations without exposing future product.** The model must support grades, subjects, teachers, branches, and yearly cohorts beyond the pilot, while the July public experience shows only real, purchasable 2026/27 Third Secondary English content.
6. **Enforce authorization on the server.** Hidden controls, route guards, disabled buttons, and role-filtered menus are usability layers, never security boundaries.
7. **Protect confirmed user work.** Exam answers, drafts, proof uploads, grades, payments, entitlements, and audit records must survive refreshes, retries, reconnects, duplicate requests, and safe deployments as specified later in this document.
8. **Use production content inputs, not fabricated claims.** Actual prices, payment destinations, teacher biography, qualifications, teacher photographs, student results/testimonials, legal copy, domain, and final marketing copy are launch-content inputs supplied by the owner. The implementation must provide validated CMS/settings fields and safe temporary placeholders, but must not invent credentials, results, or payment details.
9. **Escalate only true contradictions or blockers.** When a requirement is demonstrably incompatible with another, document the conflict, its consequence, and the safest resolution. The known WCAG/captions conflict is recorded below and must not be concealed.
10. **Prove completion.** A feature is complete only when its happy path, permissions, Arabic RTL behavior, responsive layouts, light/dark themes, loading/empty/error/offline states, security controls, observability, and automated/manual acceptance checks pass.
11. **Lean V1 has precedence.** The authoritative Lean V1 decisions immediately below supersede every conflicting historical scale target, provider reference, OTP/email flow, and managed-infrastructure requirement elsewhere in this document. A conflicting paragraph remains only as a labeled post-V1 upgrade contract and must not be implemented, provisioned, purchased, exposed, or treated as a launch gate.

### Authoritative Lean V1 deployment and product profile

This is the only launch profile Antigravity implements:

- **Paid recurring services:** one Hostinger KVM 4 VPS and one academy-owned domain. No other paid recurring provider is required for launch.
- **KVM 4 planning envelope:** 4 vCPU, 16 GB RAM, 200 GB disk, and 16 TB monthly transfer, subject to the actual purchased-plan values shown in Hostinger hPanel. The application enforces operational warnings at 8 TB, 10 TB and 12 TB projected monthly transfer and never assumes the nominal ceiling is a safe target.
- **Single-host modular monolith:** NGINX, `academy-web`, `staff-admin`, NestJS API, worker, PostgreSQL, Valkey and ClamAV run as isolated non-root containers on KVM 4. There is no launch load balancer, second app node, managed database, managed Valkey, DigitalOcean, Spaces, Bunny, CEQUENS, Postmark, Sentry or Backblaze dependency.
- **External free services:** Cloudflare Free protects DNS, TLS, website/API proxying, WAF, Turnstile and staff Access; Better Stack Free supplies bounded uptime/heartbeat/log monitoring; a private Cloudflare R2 bucket uses the free allowance only for encrypted database/config/audit-root backups. If any free allowance would be exceeded, the platform alerts and requires an explicit owner upgrade decision rather than silently incurring cost.
- **Authentication:** launch is closed/invite-or-roster-only. There is no public self-registration, SMS OTP, phone verification, email verification, automated forgot-password flow or remote phone-change flow. Student and guardian accounts are pre-created/imported by authorized staff with a unique normalized but explicitly `UNVERIFIED_V1` phone, optional unverified email, and one-use activation credential/temporary random password. Primary login is phone plus password; email is profile/contact data only and cannot authenticate, recover an account or receive sensitive content.
- **Safe V1 recovery:** an authenticated user changes password only with the old password. If forgotten, authorized customer service performs the roster/guardian-backed manual identity ceremony, then invokes a named audited reset command. Staff can never view or type a permanent password: the server revokes all sessions, generates a strong one-use temporary credential, displays it once, and forces the user to choose a new password on next login. Remote knowledge, WhatsApp message, student code, payment screenshot or caller ID alone is insufficient. Staff administration remains protected by password plus free authenticator-app TOTP and Cloudflare Access.
- **Future OTP migration:** CEQUENS is deferred. Phone uniqueness is reserved now, but no UI may call an unverified phone “verified.” When OTP is later enabled, existing accounts enter a versioned verification campaign; new public registration, automated recovery, new-device OTP and sensitive phone changes remain disabled until that separate release passes its gates.
- **No application email:** launch produces no application email or SMS. Academic, account, payment, report and support events are in-app only. Operational paging uses a private Telegram bot plus Better Stack. Cloudflare may independently email staff its own Access challenge; that does not create an academy email subsystem.
- **Self-hosted video:** Antigravity builds provider-independent adaptive HLS. The academy records 1080p masters and retains them offline in two owner-controlled physical copies. Encoding happens on an operator workstation, not on the production VPS. Launch uploads only finalized HLS with 720p as the default rendition and 480p as automatic weak-network/data-saver fallback. Use H.264/AAC, 25/30 fps, approximately 1.0–1.1 Mbps video plus 64 Kbps mono audio for 720p, approximately 0.5–0.65 Mbps video plus 64 Kbps audio for 480p, and 6–10 second segments; every asset must pass a real readability/playback sample before publication.
- **Video origin:** `media.<domain>` is DNS-only/grey-clouded and serves authorized HLS directly from NGINX because ordinary Cloudflare CDN proxying is not the launch video-delivery service. HLS objects live outside the public root. The API creates a short-lived signed playback session after account, entitlement, device, release, prerequisite and activity-lease checks; NGINX validates the signed request. No master MP4 is stored or served. The player supplies moving real-name/student-ID watermark, resume, seek/up-to-2x, data saver and progress heartbeats. This deters sharing but is not represented as true DRM or screen-record prevention.
- **Video capacity model:** four two-hour lessons per four-week month equals eight watch-hours per fully active student. At 3,000 fully active students this is 24,000 watch-hours. The expected 720p-default/480p-fallback mix plus 15% rewatch/overhead is planned around 12 TB/month; the result is an estimate, not a guarantee. Actual bytes/watch-hour and concurrency are measured from day one. Migrate HLS delivery to the already abstracted R2/edge adapter before projected transfer exceeds 12 TB, stored HLS exceeds 120 GB, peak video concurrency exceeds the accepted KVM 4 load result, or video affects API/exam SLOs.
- **Storage discipline:** reserve at least 25% of the VPS disk; warn at 65% and page at 75%. Keep no production master video, long-lived database dump, build cache or unbounded log on the host. Finalized HLS, private uploads and database growth have separate quotas. Never delete still-entitled lessons merely to avoid a disk alert.
- **Reliability statement:** KVM 4 is the accepted economical V1 origin, not high availability. Host/VPS failure can temporarily take down the academy. Daily encrypted off-host database backups, tested restore, immutable releases, health monitoring and a rehearsed rebuild runbook are mandatory; an under-one-hour RTO, 15-minute RPO, multi-region DR and 2,000-concurrent promise are deferred until funded and proven.

## Executive Delivery Contract

The launch outcome is a hardened, mobile-first PWA that Egyptian students and their guardians can use regularly on ordinary phones and constrained mobile data. A student must be able to register or claim a center account, link a guardian, purchase access through a reviewed manual payment, securely learn from videos and PDFs, complete reliable MCQ assessments, monitor progress, ask for help, and recover from common account/network problems. Guardians must be able to follow multiple children without entering private academic conversations. Mr. Bahrawy and permissioned assistants must be able to operate the academy safely without developer intervention.

The July 31 deadline does not permit releasing a fragile core. Authentication, authorization, student/guardian isolation, payment and entitlement correctness, assessment durability, account recovery, device enforcement, private-data protection, and auditable financial actions are non-waivable release gates. If any of those fail acceptance, the public core is not ready.

Lower-priority modules may not weaken that standard. Subjective assignments, anonymized published FAQ, coupons, monthly reports, and the standalone practice bank are added July targets. Ship each only if its entire acceptance surface passes; otherwise keep its flag off and continue after launch. The user experience must remain coherent when every added target is disabled.

The platform is for a single teacher and a single pilot subject at launch, but it is cohort-based rather than timeless. Every enrollment, entitlement, course, assessment, report, roster record, and student identifier must be associated with the appropriate academic cohort and fixed product end date. Future yearly cohorts must be addable without overwriting historical grades, payments, progress, or reports.

Definition of release classes:

- **P0 / public core:** Mandatory for public operation on 31 July 2026. A failed P0 gate blocks release.
- **Added July target:** Valuable and targeted for July, but independently hidden if incomplete or unaccepted.
- **Post-launch:** Deliberately deferred and excluded from the July critical path.
- **Content input:** Owner-supplied production data required before launch but not a software-design unknown.

---

## Document Map

- **Sections 1–15 — Product and experience:** scope, roles, navigation, every public/student/guardian/staff surface, core journeys, visual system, accessibility, notifications, release placement, and UX acceptance.
- **Sections 16–24 — Application and data contract:** modular backend, REST API, relational schema, domain state machines, commerce, assessments, identity, guardian isolation, RBAC, audit, jobs, files, retention, security, and backend release gates.
- **Sections 25–33 — Production engineering:** production stack, monorepo, environments, topology, data services, recovery, providers, IaC, secrets, CI/CD, observability, SLOs, test strategy, capacity proof, pilot, and independent security review.
- **Sections 34–41 — Delivery and handoff:** day-by-day critical path, staged rollout, operations/runbooks, launch checklists, roadmap, universal definition of done, traceability, assumptions, and reference baseline.

Read sections 1–24 as the behavior contract and sections 25–41 as the proof-and-delivery contract. When implementing a vertical slice, satisfy both halves: for example, a payment flow is incomplete until its product states, API/domain rules, authorization, audit, alerts, tests, reconciliation, runbook, and release evidence all exist.

---

## 1. Product Definition and Release Model

Bahrawy Academy / أكاديمية البحراوي is an Arabic-first, mobile-first PWA for Egyptian students, led by Mr. Bahrawy / مستر البحراوي. The initial commercial launch serves the 2026/27 Third Secondary English cohort. The data model and navigation must support future grades, subjects, teachers, branches, and yearly cohorts without exposing empty future areas.

The experience must feel premium, energetic, trustworthy, and teacher-led while remaining simple on low-end phones and constrained mobile data. Every primary action should answer one of four questions immediately: what should I learn next, what do I owe, how am I performing, and where can I get help?

Products are sold as course, term, or full-year access in EGP. Each product has an explicit fixed access end date. Existing eligible purchases receive an automatically calculated credit toward a bundle upgrade; the checkout must show original price, credited amount, discounts, final difference, and unchanged access end date before submission.

Release classes:

- **July 31, 2026 P0 public core:** Registration and offline claim, guardian linking, catalog and previews, manual payments and entitlements, secure video and PDFs, MCQ quizzes/exams, progress, student/guardian/staff portals, notifications, support, device controls, audit/security, responsive light/dark UI.
- **Added July targets:** Subjective assignments, publishable anonymized FAQ, coupons, monthly guardian reports, and standalone practice bank. Each is independently feature-flagged and completely absent from navigation, search, deep links, and public claims until its acceptance suite passes.
- **Post-launch order:** Communication and retention first; broader practice and competition second; automated Paymob/card/Fawry integration later.
- No native apps, live classes, offline video, casting, captions, audio questions, certificates, Google login, or leaderboard at launch. Do not render “coming soon” dead ends.

## 2. Personas, Roles, and Privacy Boundaries

| Persona / role         | Needs and permissions                                                                                                                                                                                              | Explicit boundaries                                                                                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Online student         | Staff-invited V1 account; activate/login by normalized unverified phone plus temporary/permanent password; browse/purchase; learn; assess; view own progress/payments; ask private questions; open support tickets | No public self-registration or automated recovery; cannot approve payments, alter entitlements, remove devices, see another identity, or read another student’s private questions    |
| Offline/center student | Activate a preloaded roster record using the exact roster phone plus one-use academy activation credential; otherwise has the same learning experience                                                             | Phone remains `UNVERIFIED_V1`; the four-digit number is a non-secret identifier and never the activation credential or password                                                      |
| Primary guardian       | Required staff-created/activation-bound link; may manage multiple children; view each child’s progress, grades, reports, entitlements and payments; initiate/upload payments; receive in-app alerts                | Launch link is identity-checked manually but not phone/email-verified; cannot read private teacher questions, answer assessments, control student devices or impersonate the student |
| Secondary guardian     | Optional staff-created link with the same child-view permissions unless revoked                                                                                                                                    | Cannot become primary silently; link changes and manual identity basis are audited                                                                                                   |
| Teacher/owner          | Full academic and operational overview; course/exam authority; answer questions; manage assistants                                                                                                                 | High-risk actions remain confirmed and audited                                                                                                                                       |
| Administrator          | Staff accounts/RBAC, platform settings, cohorts, security, audit, student/guardian recovery                                                                                                                        | Must not bypass audit or financial state transitions                                                                                                                                 |
| Content assistant      | Create, edit, schedule, publish, archive courses, lessons, videos, files, and assessment content                                                                                                                   | Any assigned content assistant may publish; no implied finance permission                                                                                                            |
| Academic assistant     | Answer private questions, approve anonymized publication, grade subjective work, inspect progress and attempts                                                                                                     | No finance/refund authority unless separately assigned                                                                                                                               |
| Finance assistant      | Approve/reject/reverse/refund manual payments, inspect proof/reference, manage financial records and eligible coupons                                                                                              | Cannot edit academic answers/content unless separately assigned                                                                                                                      |
| Support assistant      | Triage tickets, inspect sufficient account/payment context, escalate fixed-exam incidents, perform only explicitly granted recovery actions                                                                        | Device removal is staff-only and permission-gated; no question content or grade editing                                                                                              |
| System services        | Deliver in-app alerts/reports, enforce entitlements, process video progress/backups and scheduled jobs                                                                                                             | No launch SMS/application email; all automated changes produce traceable status/events                                                                                               |

Staff may hold multiple roles. Navigation visibility is permission-derived, but hiding UI is never the authorization control. Sensitive student information is revealed only as needed for the role.

The offline four-digit ID must be displayed and searched as a composite with branch and academic year, for example `Nasr City / 2026–27 / 0421`, because four digits are not globally unique. Online student IDs are numeric and start above 10,000. Neither identifier is a credential.

## 3. Information Architecture and Navigation

### 3.1 Public

- `/` — homepage
- `/courses` — public storefront of purchasable `COURSE`, `TERM`, and `FULL_YEAR` products
- `/courses/:productSlug` — canonical product detail; the URL label is marketing language, while the backing entity is always a product
- `/preview/:lessonSlug` — selected full free lesson
- `/login`, `/activate` — V1 login and one-use staff/roster activation; public `/register`, `/verify-phone`, and automated `/forgot-password` do not exist
- `/claim` — offline roster activation using roster match plus a separate one-use activation credential
- `/contact` — support information and WhatsApp entry
- `/terms`, `/privacy`, `/refund-policy`, `/accessibility`

The pilot must not display empty grade or subject filters. The underlying catalog may support them, and they appear only after multiple live values exist.

Do not conflate a product with a course. A **product** is the priced, dated thing purchased; a **course** is an academic content container included by a product grant. The public `/courses` route is intentionally product-based because Egyptian students expect “courses/packages” there. Its data source is `/public/products`; product detail aggregates included course/term curriculum and reviews. Authenticated learning uses course IDs/slugs under the student application and never treats a term/full-year package as a course record.

### 3.2 Student app

On mobile use a persistent five-item bottom navigation: **الرئيسية، كورساتي، التدريب، أسئلتي، حسابي**. Put notifications in the header. Hide the global bottom bar inside lesson and exam players. On tablet/desktop use the same structure as a side navigation.

- Dashboard
- My courses and course outline
- Lesson player
- Assessments and results
- Added-target practice bank
- Added-target assignments
- Private questions and published lesson FAQ
- Progress/monthly reports
- Notifications
- Purchases and payment submissions
- Support
- Profile, guardian links, security, device visibility, data saver, theme

When the standalone practice bank is disabled, the **التدريب** destination must resolve to the student’s available lesson quizzes rather than to a hidden or empty module.

### 3.3 Guardian app

Use a prominent child switcher that always shows which child is active.

- Guardian dashboard
- Child overview/progress
- Grades and attempts
- Courses/entitlements
- Payments and proof submission
- Monthly reports
- Notifications
- Support
- Guardian profile, contact details, notification preferences, child links

Do not include private questions or device controls in guardian routes or APIs.

### 3.4 Staff app

Use a desktop-first collapsible sidebar, permission-filtered dashboard, saved filters, and dense tables with an accessible card fallback on mobile.

- Role-specific overview
- Products/courses, curriculum, media/files, previews, publication
- Question banks, quizzes/exams, attempts
- Added-target assignments and grading
- Added-target practice bank
- Students, cohorts, online IDs, offline roster/claims/codes
- Guardians and link recovery
- Entitlements and subscriptions
- Manual payments, reversals/refunds, exports
- Added-target coupons
- Private questions and anonymized FAQ moderation
- Notifications/announcements and added-target monthly reports
- Support queue
- Public reviews moderation
- Operational reports/exports
- Staff roles, settings, security, device removal, audit log

## 4. Public Screens

| Screen              | Required content and behavior                                                                                                                                                                                                                                                                                            | Required states                                                                                                                                                                                                                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage            | Teacher-led hero with real Mr. Bahrawy photography; clear Third Secondary English promise; primary “اشترك الآن” and secondary free-lesson CTA; qualifications; course benefits; available products; real results/testimonials with consent; verified reviews; offers if active; FAQ; support hours; contact/social links | Published content, no active offer, no public reviews yet, slow-image placeholder, CMS section unavailable without breaking the page                                                                                                                                                            |
| Catalog             | Course/term/full-year cards showing title, cohort, product type, price, fixed end date, lesson count, duration, availability, owned status, and correct CTA                                                                                                                                                              | Available, already owned, upgrade eligible, upcoming, closed, expired, empty search                                                                                                                                                                                                             |
| Product detail      | Canonical product title/slug and type; included course/term scope; outcomes, teacher, curriculum summary, duration, included downloadable/view-only materials, assessment policy, fixed access end date, price, upgrade credit, included-course reviews, free full lesson, payment method, refund/legal links            | Buy, continue learning, upgrade, pending payment, unavailable, access expired; never imply a term/year product is one course                                                                                                                                                                    |
| Free preview        | Full selected lesson in protected player; no paid PDFs, private Q&A, progress credit, or entitlement leakage; CTA after meaningful viewing                                                                                                                                                                               | Ready, processing, expired preview token, video unavailable, weak network/data-saver                                                                                                                                                                                                            |
| Registration        | Phone verification first, then student name/password, 2026/27 membership, required primary guardian name/relation/distinct phone and optional pending email suggestion; linked current terms/privacy versions and clear acceptance/guardian copy                                                                         | Inline validation, enumeration-safe generic pre-OTP response, existing-account login/recovery only after phone proof, OTP sent/resend timer, incorrect/expired OTP, guardian existing/new state only after invited-phone proof, policy version changed requiring rereview, SMS delivery failure |
| Guardian activation | Guardian verifies their own phone by OTP and creates/uses a guardian account; one guardian account may link multiple children                                                                                                                                                                                            | New guardian, existing guardian, invitation expired, wrong phone, link already accepted                                                                                                                                                                                                         |
| Offline claim       | “طالب سنتر” path; branch/year/four-digit ID plus roster-matching phone; OTP only to roster phone; then password and guardian verification                                                                                                                                                                                | Exact match, multiple matches requiring branch/year selection, already claimed, phone mismatch with support CTA, voided/claim-under-review record, expired cohort                                                                                                                               |
| Login/recovery      | Phone/password and show-password; no public registration, OTP, forgot-password or Google button; forgotten password displays customer-service instructions                                                                                                                                                               | Invalid credentials, rate limited, explicitly unverified phone, suspended account, new device blocked, session expired, one-use staff reset requiring permanent-password change                                                                                                                 |
| Legal/contact       | Arabic terms, privacy, refund policy, support hours 10:00–22:00 Cairo daily, WhatsApp link, ticket entry                                                                                                                                                                                                                 | Versioned content, contact unavailable, outside-hours message with expected response                                                                                                                                                                                                            |

Course reviews are marked **مشترك موثّق** only when the student obtained a valid order/roster/manual entitlement for that course, it was not reversed/fully refunded/revoked, and authoritative `learning_item_progress` shows at least one normally completed non-preview course lesson under that lesson's immutable mode (`VIDEO_90`, `PASS_LINKED_ASSESSMENT`, or `MANUAL_ACK`). An expired fixed-date entitlement may remain historically verified; partial refund with `KEEP_ACCESS` remains eligible, while `REVOKE_ACCESS` withdraws it. One logical editable review is allowed per student/course: rating 1–5 plus 20–1,000 characters. Moderation precedes publication. Public display is anonymous by default; a recognizable short name requires separate student and **current active primary guardian** opt-in and may be withdrawn at any time. Primary transfer/revocation immediately falls back to anonymous until the new primary separately opts in. Moderation removes phone, school, address, handles, payment details, or other identifying free text.

## 5. Student Screens

| Screen                      | Required content and primary actions                                                                                                                                                                                                                                                                                                                                            | Required non-happy states                                                                                                                                                                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                   | Resume the latest lesson; active products and fixed end dates; progress; next available quiz/exam; pending payment/assignment/question; notification highlights; support shortcut                                                                                                                                                                                               | New user, no entitlement, payment pending/rejected, all current lessons complete, course expired, scheduled content                                                                                                                                                              |
| My courses                  | Active, pending, completed/expired products; progress; “كمّل من حيث توقفت”; upgrade eligibility                                                                                                                                                                                                                                                                                 | No courses, pending access, expired access, hidden/archived course with retained history                                                                                                                                                                                         |
| Course outline              | Chapters/lessons, optional duration, authoritative completion, locked prerequisites, scheduled release, quiz/exam markers, resources, and mode-specific remaining requirement                                                                                                                                                                                                   | Empty/scheduled chapter, unavailable lesson, entitlement expired; never show a watch percentage for a non-video mode                                                                                                                                                             |
| Lesson view                 | `VIDEO_90`: protected adaptive stream, watermark, resume, seek/up-to-2×, quality/data saver and unique-watch progress. `PASS_LINKED_ASSESSMENT`: lesson resources/objectives plus linked quiz CTA and fail/pass/result-waiting state. `MANUAL_ACK`: resources/content plus explicit mark-complete action. All modes include previous/next, private ask-teacher and enabled FAQ. | Video processing/retry/lease/device states only for video; linked assessment unavailable/failed/graded-unreleased/passed; manual action pending/completed; entitlement/schedule and PDF states for all applicable modes                                                          |
| Lesson completion           | `VIDEO_90` requires 90% unique watch; `PASS_LINKED_ASSESSMENT` requires a released passing linked result; `MANUAL_ACK` requires the explicit authorized idempotent action.                                                                                                                                                                                                      | Show the exact mode-specific remaining requirement without accusation; repeated watch/file opens/analytics do not inflate or fabricate completion                                                                                                                                |
| Quiz list/player            | Instructions, fixed launch attempt policy, frozen pass score (60% pilot default), start confirmation, one MCQ per view on phones, answer navigation, autosave, submit confirmation                                                                                                                                                                                              | Unlimited lesson-quiz attempts at launch; lost connection with local/server save indicator; expired session preserving answers; submission retry; incomplete answers warning                                                                                                     |
| Exam list/player            | Upcoming/live/missed/submitted/graded states; availability, duration, one attempt at launch plus audited authorization, server-authoritative timer, autosave, fixed-exam support CTA                                                                                                                                                                                            | Existing active exam blocks a newcomer; reconnection resumes the same valid attempt; closing-time warning; submitted attempt cannot reopen; support ticket tagged fixed-exam priority                                                                                            |
| Results                     | Score, pass/fail, correct/incorrect counts, permitted explanations and attempt history only after the frozen release event; MCQ grading may be immediate while visibility remains after-window/manual                                                                                                                                                                           | Graded but unreleased, release delayed/blocked, corrected revision, attempt voided; a separate audited one-use authorization may permit a new attempt, but the old attempt never reopens                                                                                         |
| Assignments — July target   | List/detail; typed answer or image/PDF upload; draft; submit; status; teacher score/feedback; resubmission only when explicitly returned                                                                                                                                                                                                                                        | Upload validation/progress/failure, overdue, returned, pending grade, graded, feature hidden if unaccepted                                                                                                                                                                       |
| Practice bank — July target | Filters by course/chapter/unit/lesson/difficulty/type; session length; MCQ practice; score, explanations, weak-topic lesson recommendations                                                                                                                                                                                                                                     | No matching questions, interrupted resumable session, explanations unavailable, feature hidden                                                                                                                                                                                   |
| Questions                   | Create a typed private question tied to course/lesson/category, with permitted image/PDF attachment; list own questions and replies; search published anonymized FAQ                                                                                                                                                                                                            | Pending, answered, closed, attachment rejected, duplicate suggestion, no questions; no audio                                                                                                                                                                                     |
| Progress/reports            | Course completion, unique watch, quiz/exam performance, activity by period; July-target monthly report history                                                                                                                                                                                                                                                                  | Insufficient data, report generating, delivery failed, feature hidden                                                                                                                                                                                                            |
| Notifications               | Read/unread feed, category filter, deep links, mark read                                                                                                                                                                                                                                                                                                                        | Empty, expired target, delivery delay                                                                                                                                                                                                                                            |
| Payments                    | Orders, instructions for InstaPay/wallet, exact amount due, transfer Cairo date/time/reference, proof upload, in-app status/payment confirmation, upgrade calculation                                                                                                                                                                                                           | One open submission per order; pending with “within 12 hours”; approved, rejected with reason/next step, wrong-amount return/reconciliation, funding review/top-up, reversed, refunded; duplicate/reference error; upload failure; no receipt/tax-invoice generation or download |
| Support                     | Ticket category, description, allowed attachment, ticket ID/status/history; WhatsApp link; fixed-exam shortcut                                                                                                                                                                                                                                                                  | Outside hours, queued, awaiting user, resolved/reopened, upload failed                                                                                                                                                                                                           |
| Account/security            | Student details, explicitly unverified phone/optional email, linked guardians, theme/data saver, approved-device list as read-only, password change with old password, data export/deletion and device/password-help requests                                                                                                                                                   | No self phone/email change at V1; two-device limit, new-device warning, staff-issued one-use reset after manual identity ceremony, export preparing/expired, deletion grace/cancel, suspended account                                                                            |

Do not render certificates or leaderboard placeholders at launch.

## 6. Guardian Screens

| Screen                        | Required content/actions                                                                                                                                       | Required states                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard                     | Child switcher; concise progress, latest grades, missed/upcoming work, payment status, urgent alert, monthly report CTA                                        | One child, multiple children, invited link pending, access revoked, no activity                                                                            |
| Child learning                | Course progress, lesson completion, time/activity summaries, quiz/exam grades, assignment status                                                               | Course expired, insufficient data, result not released                                                                                                     |
| Payments                      | View all child orders and entitlements; initiate purchase/upgrade; upload manual proof/reference; view in-app status/payment confirmation                      | Same payment states and 12-hour expectation as student; never expose finance staff notes or offer a receipt/tax-invoice download                           |
| Monthly reports — July target | Secure authenticated in-app/web report and in-app ready notification only                                                                                      | Generating, ready, failed, no activity; retry visible to authorized staff; no email/SMS delivery state                                                     |
| Alerts                        | Payment, missed/upcoming academic events, urgent security/operational messages, exact named-review consent requests for the current primary                    | Read/unread, deep link expired, review changed/already anonymous/consent withdrawn                                                                         |
| Support                       | Open and follow tickets for account, payment, course, video, or exam issues                                                                                    | Fixed-exam priority path, outside-hours message                                                                                                            |
| Profile/links                 | Own explicitly unverified phone/optional email, password change with old password, linked children/invitations, allowed-scope data export and deletion request | No self-service contact mutation/recovery at V1; duplicate account, revoked link, sole-primary transfer required before deletion, export preparing/expired |

V1 sends no academy SMS or application email. Every guardian notification is an authenticated in-app event and guardians never receive private student-teacher question content. Provider-independent SMS/email abstractions may exist behind disabled flags only; no template, credential or background send is a launch dependency.

## 7. Staff Screens and Operational UX

| Area                              | Required behavior                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Role dashboard                    | Teacher sees academic and commercial overview; each assistant sees only relevant queues, SLA counters, anomalies, and shortcuts. Do not display misleading zeroes for unauthorized data.                                                                                                                                                                                                                    |
| Public CMS/legal                  | Structured homepage/pages, teacher profile, marketing FAQ, SEO/social metadata, testimonials with private consent evidence, and preview/schedule/publish. Legal documents are versioned immutable publications restricted to owner/admin permission; registration/order preview shows exact required versions.                                                                                              |
| Product/offer editor              | Owner/finance-commerce permission controls product type, included content scope, EGP price, sale window, fixed end date, and upgrade paths; validation/price preview before activation. Content role alone is read-only here.                                                                                                                                                                               |
| Course/content editor             | Draft autosave; cohort/subject/curriculum builder; lessons/resources/media; preview designation; publish/schedule/archive; validation summary. Assigned content assistants may publish academic content, including MCQ assessments, without gaining price/finance authority.                                                                                                                                |
| Media/files                       | Manifest-based upload of workstation-generated 720p/480p HLS, checksums, poster/metadata, NGINX-origin/security status, sampled readability/playback result, storage/transfer projections, per-file downloadable vs view-only, and versioned replacement without losing lesson analytics. No production transcoding or managed video-service dependency.                                                    |
| Assessments                       | MCQ bank core; quiz/exam configuration; 60% quiz default; fixed launch policy of unlimited lesson quizzes and one chapter/final attempt plus audited authorization; whole-attempt availability/timer/randomization; preview; publish validation; attempt inspector and audited corrections.                                                                                                                 |
| Assignments — target              | Rubric/score/due date; grading queue; typed/image/PDF viewer; feedback; return/resubmit; bulk filters.                                                                                                                                                                                                                                                                                                      |
| Students/cohorts                  | Search by name, phone, cohort, online ID, branch/year/offline ID; profile, entitlement/progress/login/device activity; suspend/reactivate; assign entitlement; export within permissions.                                                                                                                                                                                                                   |
| Offline roster                    | Import validation preview; collision/missing-phone report; branch/year-scoped four-digit allocation; print/export IDs; claim status; resend activation; never print passwords.                                                                                                                                                                                                                              |
| Guardians                         | Linked children, primary/secondary status, verification state, recovery/replace flow, audit trail. Staff cannot see private questions without academic permission.                                                                                                                                                                                                                                          |
| Devices/security                  | Two approved devices; view session/activity; authorized staff removal with reason and confirmation; one-active-stream/exam conflict context; new-device alerts; suspicious-login state.                                                                                                                                                                                                                     |
| Manual payments                   | Queue sorted by age and risk; proof/reference viewer; declared versus finance-verified amount/date/destination; child/product/upgrade context; exact-value approval or structured rejection; wrong-value cash-return cases; dependent-upgrade funding cases/top-up/unwind; reverse/refund with stronger confirmation and immutable audit; export/reconciliation. Finance assistants hold these permissions. |
| Coupons — target                  | Fixed/percentage; validity window; total/per-student limits; course/product/student scope; usage and remaining count; preview resulting price; deactivate without rewriting prior orders.                                                                                                                                                                                                                   |
| Private questions / published FAQ | P0 private inbox, teacher/academic replies, close/audited reopen, search/export within policy. Added-target controls separately remove personal details, preview anonymization, publish, search, and withdraw; disabling the target never hides the private inbox.                                                                                                                                          |
| Communications                    | In-app announcements and transactional templates; audience preview by cohort/course; schedule; delivery status; test send; mandatory security messages and in-app payment statuses cannot be converted into marketing.                                                                                                                                                                                      |
| Reports                           | Student/course/assessment/payment operational views; permission-aware CSV/PDF export; monthly report generation/delivery status when enabled.                                                                                                                                                                                                                                                               |
| Support                           | Categories and SLA; fixed-exam tickets pinned to priority queue; ownership, internal note vs user-visible reply, escalation, status history; operating hours visible.                                                                                                                                                                                                                                       |
| Reviews                           | Verify eligibility, moderate, publish/reject with reason, remove personal data, audit changes.                                                                                                                                                                                                                                                                                                              |
| Settings/audit                    | Staff RBAC, support hours, versioned payment destinations, notification templates, branch/cohort configuration, brand/legal content, read-only fixed launch device-policy summary plus device activity/revocation, and audit search. The two-device/staff-only-removal/newcomer-blocked policy is not editable at launch. High-risk changes require reauthentication and confirmation.                      |

Every destructive or financial transition uses a descriptive confirmation showing the affected student/order and resulting state. Success produces a confirmation toast plus a durable in-app status timeline entry, never a generated/downloadable receipt or tax invoice. Bulk actions first show the exact affected count and validation errors.

## 8. Core Journeys

### 8.1 Online enrollment

1. Visitor enters the Third Secondary English product from home/catalog.
2. Product detail makes price, product type, fixed end date, curriculum, free lesson, and manual-payment expectation explicit.
3. Public registration is closed. Authorized staff pre-creates/imports the student, unique `UNVERIFIED_V1` phone, membership and one-use high-entropy activation credential. The student uses `/activate`, enters that phone plus credential, chooses a password and consumes the credential transactionally.
4. Staff pre-creates the required primary-guardian link/account from the academy’s roster/manual identity procedure. The guardian separately consumes their own one-use activation credential and chooses a password; neither phone nor optional email is labeled verified.
5. Student or guardian chooses product/eligible upgrade, reviews price calculation, applies an accepted coupon only if that target is live, and creates one order.
6. UI displays the admin-configured InstaPay/wallet destination and a copyable order/reference value.
7. Payer uploads image/PDF proof and transfer reference. Status becomes pending with a visible 12-hour review expectation; paid access remains locked.
8. Finance approves or rejects. Both linked actors see the same durable status; approval creates entitlement automatically and deep-links to the course.

### 8.2 Offline roster claim

1. Student chooses **أنا طالب في السنتر**.
2. Enter branch, academic year, four-digit non-secret ID, and roster phone.
3. The student supplies the exact roster phone plus a separate one-use high-entropy activation credential delivered by the academy; the four-digit identifier alone reveals nothing and cannot activate.
4. On a valid, unexpired, matching activation credential, set the password and complete the separately activated required guardian link; phone remains `UNVERIFIED_V1`.
5. Existing preassigned entitlements appear; already-claimed/mismatched records route to support without revealing roster data.

### 8.3 Returning learning session

1. The dashboard’s dominant CTA resumes the latest incomplete lesson at its mode-appropriate step.
2. Entitlement/release/prerequisite checks always run; device/activity-stream checks additionally run before video or assessment activity.
3. `VIDEO_90` resumes the last position with data-saver/quality controls and completes at 90% valid unique watch.
4. `PASS_LINKED_ASSESSMENT` opens the linked-quiz requirement or truthful fail/graded-unreleased/pass state; `MANUAL_ACK` opens content with its explicit action. Neither shows fictitious watch progress.
5. After authoritative completion, the next CTA leads to the next available learning item, never an ambiguous dashboard detour.

### 8.4 Quiz/exam

1. Instructions show pass score, attempts, timer, availability, and result-release policy.
2. Start requires explicit confirmation.
3. Every answer autosaves with visible saved/saving/offline status.
4. A network interruption does not create a second attempt; valid reconnection resumes it.
5. Another device/session attempting to start is blocked while the existing stream/exam continues.
6. Submission is confirmed and idempotent. MCQ results appear immediately unless intentionally scheduled. A completed one-attempt exam never reopens; staff may void it and separately authorize one new attempt for a documented incident/accommodation.

### 8.5 Private question to public FAQ

1. Student submits a course/lesson-scoped private question.
2. Teacher or academic assistant replies privately.
3. Staff may separately choose **publish as FAQ**, remove all personal details, preview the anonymized question/answer, and publish.
4. The published FAQ is searchable by other students; the original remains private and linked internally for audit.

### 8.6 V1 password/contact/device recovery

- There is no self-service phone change, email change, automated forgot-password or OTP recovery at launch. Contact correction uses a named staff command after the manual roster/guardian identity ceremony, collision preview, reason, recent staff TOTP and audit; it never implies phone ownership verification.
- An authenticated user changes password only after providing the current password. A forgotten-password case is customer-service initiated: the server revokes sessions, creates one short-lived one-use temporary credential, shows it once to the authorized staff actor, and forces a new password at next login. Staff never views or sets the permanent password.
- Students see approved devices but cannot remove them. Authorized staff remove a device after the same bounded identity procedure; a new third device remains blocked until then.
- A new concurrent stream/exam attempt is blocked, not the established session.

## 9. Visual and Interaction System

### 9.1 Brand direction

- Canonical names: **Bahrawy Academy / أكاديمية البحراوي** and **Mr. Bahrawy / مستر البحراوي**.
- Use a modern BA monogram plus bilingual wordmark. The monogram must remain legible at 24 px and in one color.
- Hero and marketing content use commissioned real teacher photography, authentic classroom/material imagery, and consented student outcomes. Avoid stock-photo-led identity and childish school graphics.
- Tone is confident, warm Egyptian Arabic: direct, encouraging, never patronizing or overly slang-heavy.

### 9.2 Color tokens

Use semantic tokens rather than raw values in components. Initial accessible palette:

| Token                |     Light |      Dark |
| -------------------- | --------: | --------: |
| Background           | `#F5F8FC` | `#07111F` |
| Surface              | `#FFFFFF` | `#0D1B2A` |
| Raised surface       | `#EDF4FA` | `#13263A` |
| Primary/navy         | `#0A2240` | `#43CDFC` |
| Electric cyan accent | `#00A9E8` | `#43CDFC` |
| Amber accent         | `#F59E0B` | `#FFC247` |
| Text                 | `#0F172A` | `#F8FAFC` |
| Muted text           | `#526174` | `#B8C5D4` |
| Border               | `#D8E1EC` | `#2A4058` |
| Success              | `#16794B` | `#54D69C` |
| Warning              | `#9A5A00` | `#FFC247` |
| Danger               | `#B42318` | `#FF817A` |

Navy is the main light-theme button color with white text. Cyan/amber are accents and must not carry white text unless contrast is individually verified. Validate every actual foreground/background pair; tokens do not waive contrast testing.

### 9.3 Type and layout

- Use self-hosted **Alexandria Variable** for brand/headings and **Noto Sans Arabic** for body/UI; define fallbacks that preserve Arabic metrics.
- Arabic UI is RTL. English learning content, phone numbers, OTPs, payment references, codes, and URLs use isolated LTR spans with `dir="ltr"`; user-entered text uses `dir="auto"`.
- Use Arabic-locale dates in Cairo time and EGP amounts, but retain Western digits for copy-sensitive codes and references.
- Base body size is 16 px, minimum supportive text 14 px, and Arabic line height at least 1.5. Avoid all-caps English.
- Responsive targets: 320–767 px mobile, 768–1023 tablet, 1024+ desktop. No required student journey assumes hover or desktop.
- Minimum touch target is 44×44 CSS px; form labels stay visible above fields; errors appear beside the field and in a summary where appropriate.
- Use rounded but disciplined surfaces, energetic cyan/amber highlights, generous whitespace, clear status chips, and restrained progress graphics. Do not make commerce or exam states look game-like.
- Light/dark choice follows the system initially and persists per account/device. Every component/state must be designed in both themes.
- Motion is functional, generally 120–200 ms, and disabled/reduced under `prefers-reduced-motion`.

### 9.4 PWA and data saver

- The PWA install prompt is contextual after repeat engagement, never during registration, checkout, playback start, or an exam.
- Cache the shell and safe public/static metadata only. Paid video, assessments, proofs, and sensitive reports are not made available offline.
- The offline state clearly says reconnection is required. Queued mutations must never silently duplicate payments or submissions.
- Data Saver is persistent, suppresses autoplay and decorative media prefetch, requests a lower initial video quality, and uses compact posters. Detect poor connectivity only to suggest it, not to alter settings invisibly.

## 10. Shared Loading, Empty, Error, and Status Patterns

- **Loading:** Use layout-matched skeletons; buttons show local progress and remain protected against duplicate action. Avoid full-screen spinners after the shell is visible.
- **Empty:** Explain why the area is empty and offer one valid next action, such as browse courses, ask a question, or clear filters. Staff empty queues explicitly say there are no pending items.
- **Validation:** Preserve all valid input; identify the exact corrective action in Arabic; never clear passwords, answers, drafts, or uploads because another field failed.
- **Connectivity:** Show a persistent non-blocking offline/poor-network banner and the last successful save time in exams, assignments, and payment proof.
- **Authorization:** Distinguish login expiry, missing permission, missing entitlement, expired product, suspended account, device limit, and unavailable content. Each has the correct recovery CTA.
- **404/500/maintenance:** Use a branded, plain-language page with a request/reference ID for support and safe navigation. Never expose stack traces.
- **Session expiry:** Preserve a local draft/return path, authenticate, then resume the original safe action.
- **Uploads:** Support selected, validating, uploading with progress, processing, complete, rejected type/size, malware rejected, and failed/retry states. Never show success before server confirmation.
- **Scheduled/processing content:** Show a real release time or honest temporary-unavailable message; never fabricate progress.
- **Financial statuses:** Pending, approved, rejected, reversed, and refunded are distinct and immutable in the visible timeline.
- **Toast use:** Use toasts for confirmation only; anything requiring action remains inline or in the notification center.
- **Danger actions:** Confirmation names the affected entity and result; focus returns predictably after completion.

## 11. Accessibility

Target WCAG 2.2 AA for all application UI and non-video content:

- Full keyboard operation, logical focus order, visible focus, skip links, landmark structure, correct headings, accessible names, and announced validation/status changes.
- Text contrast of at least 4.5:1, large text/UI contrast of at least 3:1, and no meaning conveyed by color alone.
- Reflow without lost function at 320 CSS px and usable at 200% zoom; text-spacing overrides do not break content.
- Screen-reader equivalents for charts/progress, table captions/headers, accessible dialogs, and timer warnings at meaningful intervals.
- No unexpected focus movement, autoplay, flashing, or inaccessible drag-only curriculum controls.
- Correct Arabic language metadata and direction; embedded English is isolated.
- Exams expose remaining time as text and announcements without repeatedly interrupting the user.
- Every meaningful image in marketing, curriculum, passage, prompt, option, chart, or status content has a reviewed short alternative; complex instructional images also have an equivalent long description. Alternatives must preserve the academic task without revealing the correct answer. Decorative images use an empty alternative.
- Every P0 academy-uploaded PDF is either a properly tagged, selectable-text document with Arabic language, reading order, headings, lists/tables, form-field labels, bookmarks where long, and image alternatives, or is accompanied by a complete accessible HTML/text equivalent linked beside it. A scanned/untagged PDF without an equivalent cannot pass the non-video AA gate or be enabled as P0 content. Always show descriptive title, file type, size, and access mode.

> **Known launch contradiction — do not hide it:** Prerecorded instructional video without captions fails WCAG 2.2 Success Criterion 1.2.2 in normal circumstances. “WCAG 2.2 AA” and “no captions at launch” cannot support a truthful whole-product conformance claim. If no captions remains locked, describe the launch as **“application UI and non-video content designed to WCAG 2.2 AA”** and do not claim full platform conformance. If a full AA claim is legally or contractually required, Arabic captions/transcripts become a P0 launch requirement and the owner must approve that scope change.

## 12. Notifications and Support

| Event                                                                        | Lean V1 delivery                                                                                                  | Deferred delivery                              |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Activation issued/consumed, password reset/change, new-device/security alert | Durable authenticated in-app event; temporary activation/reset value is shown once only during its staff ceremony | SMS/email after verified-channel release       |
| Payment proof received/status changed/refund                                 | In-app to student and linked guardian only                                                                        | Payment status remains excluded from SMS/email |
| Question answered/assignment graded                                          | In-app                                                                                                            | Preference-based email later                   |
| Exam scheduled/changed or urgent incident                                    | In-app banner/feed; staff may manually communicate outside the system                                             | Verified-channel urgent SMS later              |
| Monthly guardian report — target                                             | Guardian portal plus in-app ready/failure event                                                                   | Email/SMS after separate provider release      |
| Marketing/offer                                                              | In-app only when separately consented                                                                             | Consented external channels later              |

V1 has no academy SMS or application-email worker, credential, template or delivery-status promise. Mandatory in-app security/transaction events cannot be disabled. Every notification deep-links to an authenticated relevant screen and remains in history; future channel adapters are disabled and cannot be accidentally invoked.

Support requirements:

- Provide in-app tickets plus a clearly labeled WhatsApp link. Label WhatsApp as an external service, open it only after user action, send no account/student/payment/attempt data automatically, and warn users not to include passwords, activation/reset credentials, full payment references, or sensitive attachments; sensitive support stays in the authenticated ticket flow.
- Publish operating hours as **10:00–22:00 Africa/Cairo every day**.
- Ticket categories are account/activation/password, device, payment, course/content, video, quiz/exam, assignment, and other.
- Auto-acknowledgment includes ticket ID and expected next step; outside-hours copy does not imply live staffing.
- Fixed/scheduled exam tickets enter a dedicated priority queue and carry exam/attempt/device/network context automatically.
- The payment-review expectation is up to 12 hours. Payment screens expose status only; conversation belongs in support tickets, not ad hoc payment comments.
- User-visible replies and internal staff notes are visually and permission-wise distinct.

## 13. Release Placement

### 13.1 P0 — public by 31 July 2026

- Responsive Arabic RTL public site, Third Secondary English catalog, product detail, selected full lesson previews, and verified moderated reviews.
- Invite/roster-only student and guardian activation using unique `UNVERIFIED_V1` phones plus separate one-use credentials; no public registration/OTP; required primary and optional secondary guardian multi-child accounts.
- Offline roster import and activation-credential claim, composite offline IDs, and online IDs above 10,000.
- Old-password change and audited customer-service temporary-credential recovery; two-device policy, staff-only removal, new-device alert, and one active stream/exam with the newcomer blocked.
- Course/term/full-year orders, fixed end dates, upgrade difference, manual InstaPay/wallet proof/reference, 12-hour queue, approval/rejection/reversal/refund records, and entitlements.
- Secure video, watermark, resume, 2×/seek, 90% unique-watch completion, Data Saver, and approved PDF view/download.
- MCQ quizzes/exams, 60% quiz pass, fixed launch policy of unlimited lesson-quiz and one chapter/final attempt plus authorization, autosave/recovery, results, and progress.
- Private typed student questions and staff replies plus in-app notifications only; no academy SMS/application email at V1.
- Student, guardian, and permission-based staff portals, support tickets/WhatsApp, audit, and exports required for operations.
- Light/dark themes and WCAG-AA UI work, subject to the caption exception above.

### 13.2 Independently gated added July targets

- Typed/image/PDF assignments with upload recovery, grading, feedback, and status.
- Staff-controlled anonymized FAQ publication/search.
- Fixed and percentage coupons with scopes, limits, expiry, and usage reporting.
- Monthly guardian report generation, authenticated history and in-app ready/failure status; email/SMS delivery is post-V1.
- Standalone filtered practice bank with explanations and weak-lesson recommendations.

A target ships only when its frontend, backend, permission, Arabic copy, responsive, light/dark, accessibility, security, analytics, empty/error, and end-to-end tests pass. Otherwise its flag remains off and no route or claim is exposed.

### 13.3 Post-launch roadmap

1. **Communication and retention:** Segmented/scheduled lifecycle reminders, richer guardian preferences, delivery analytics, consented WhatsApp integration, re-engagement, and study-habit features.
2. **Practice and competition:** Additional question types, deeper remediation analytics, practice seasons, and a course-only real-name leaderboard. The leaderboard requires separate student and guardian opt-in, explains visibility, supports withdrawal, and is never academy-wide by default.
3. **Automated payments:** Paymob integration for supported cards/Fawry/wallet rails, webhook reconciliation, provider payment-confirmation/entitlement handling, and refund reconciliation. Any future fiscal receipt/invoice behavior requires separate Egyptian legal/accounting review and an approved scope change.
4. **Evaluate deferred surfaces:** Captions/transcripts should be prioritized for accessibility. Native apps, live learning, casting, audio questions, certificates, and Google login require separate product validation. Offline video remains deferred because of protection and synchronization risk.

## 14. Measurable UX Acceptance Criteria

- All P0 student and guardian journeys work at 320, 360, 390, 768, 1024, and 1440 CSS px in light and dark themes with no horizontal page scrolling or clipped primary action.
- An enrolled returning student reaches resumed playback from the dashboard in no more than two deliberate taps after authentication.
- A valid pre-created student and guardian activation can be completed without further staff mutation; a valid offline roster record can be activated in under three minutes using its separate one-use credential.
- Checkout always shows product type, end date, gross price, prior-purchase credit, coupon discount if enabled, final payable amount, payment destination, and current status before any irreversible action.
- An entitled user can identify lesson lock/release/completion state and exact remaining mode-specific requirement without opening the lesson. `VIDEO_90` completes at 90% valid unique watch; pass-linked waits for released pass; manual-ack completes only from its explicit server command. No mode displays another mode's progress semantics.
- Thirty seconds of simulated network loss during a quiz/exam, question draft, assignment upload, or payment-proof flow causes no silently lost confirmed data and no duplicate submission/order.
- A second stream/exam start is blocked with an actionable message while the established session remains uninterrupted.
- A guardian can switch children and reach current progress, latest grades, and payment status within two interactions from the guardian dashboard.
- Authorized finance staff can locate a pending proof by name, phone, order, or reference and complete a valid decision with a durable audit entry; unauthorized roles cannot see or invoke those controls.
- No public/private Q&A view reveals student identity. Publication requires a separate anonymization preview and explicit staff action.
- Every screen has verified loading, empty, validation, offline, permission, server-error, and success states applicable to it; no production CTA leads to a placeholder.
- Application UI has zero critical/serious automated accessibility violations and passes complete keyboard-only navigation, Arabic screen-reader smoke tests, 200% zoom, text-spacing, reduced-motion, and contrast checks. Do not record full WCAG AA acceptance while uncaptioned prerecorded videos remain.
- Core mobile interactions visibly acknowledge input within 100 ms; skeleton/progress appears within 500 ms when work continues. Data Saver performs no decorative image or next-video prefetch.
- Arabic copy is reviewed by a native speaker, and every phone/code/payment-reference field is tested for mixed RTL/LTR copy, paste, cursor, and screen-reader behavior.
- Moderated usability testing includes at least eight Third Secondary students across low/mid-range Android and iPhone devices, three guardians including one with multiple children, Mr. Bahrawy, and one representative of every assistant role. Core-task completion must be at least 90%, with zero unresolved critical journey, comprehension, privacy, or accessibility failures.
- P0 cannot be waived for authentication/authorization, guardian isolation, entitlement/payment correctness, exam answer durability, recovery, auditability, or exposure of student/private data.

## 15. Reconciled Requirement Changes and Remaining Conflict

- The source document’s four-grade platform becomes a future-capable architecture with only the 2026/27 Third Secondary English pilot exposed.
- The source’s teacher/admin model expands into teacher, administrator, content, academic, finance, and support permissions. Content assistants may publish, finance assistants may resolve financial states, and teacher/academic assistants answer questions.
- “Four-digit access code” becomes a non-secret, branch/year-scoped offline identifier; authentication remains phone/password plus OTP claim.
- Paymob, Google login, certificates, and leaderboard are removed from launch despite appearing in the source. Paymob and the consented course leaderboard are roadmap items; certificates and Google login have no committed release.
- Public lesson questions are private by default; only separately anonymized, staff-approved copies become public.
- General multi-grade filters, certificate cards, and leaderboard positions must not appear empty in the pilot UI.
- Screen-recording prevention cannot be guaranteed. UX should communicate reasonable deterrence—protected streaming and a moving user watermark—without making an impossible prevention claim.
- The only unresolved product-level contradiction is the full WCAG 2.2 AA target versus no video captions; use the explicit accessibility handling above.

## 16. Technical Architecture and Backend Boundaries

### 16.1 Monorepo and runtime contract

Use a TypeScript `pnpm` monorepo with these explicit application boundaries:

- `apps/academy-web`: Next.js 16 application containing the public site plus authenticated student and guardian route groups. Public, student, and guardian layouts, middleware, navigation, and authorization remain distinct inside this app; a guardian session must never acquire student actions merely because both surfaces share a deployment.
- `apps/staff-admin`: separate Next.js 16 staff application. It has no public/student bundles or routes and consumes the same generated API client with staff-only permission metadata.
- `apps/api`: NestJS 11 modular-monolith REST API and OpenAPI source of truth.
- `apps/worker`: separate NestJS process for BullMQ consumers, schedules, exports, scans, notifications, reports, reconciliation, and retention work.
- `packages/contracts`: generated OpenAPI client, shared error codes, safe value objects, and API test fixtures. Do not hand-maintain duplicate frontend DTOs.
- `packages/domain`: framework-independent value objects, policies, state machines, and calculation rules with no framework/provider imports.
- `packages/db`: Prisma 7 schema, migrations, seed data, transaction helpers, and repository adapters.
- `packages/ui`: shared RTL-aware design system primitives and tokens; it contains no persona authorization decisions.
- `packages/config`: runtime configuration schema with startup validation; secrets are referenced, never committed.
- `packages/observability`: structured logging, trace/metric helpers, Better Stack/Telegram adapters, local metrics and central redaction rules.
- `packages/testing`: authorization matrices, factories, deterministic clock, activation/reset, HLS-origin and disabled-future-channel fakes, and integration helpers.

Run on Node.js 24 LTS. Self-hosted PostgreSQL on KVM 4 is the durable source of truth. Self-hosted Valkey is limited to BullMQ, rate-limit counters, short locks/leases, session cache/revocation broadcasts and disposable query cache. Both use bounded memory/connection budgets; loss or eviction of Valkey must not lose an acknowledged answer, payment, entitlement, progress event, grade, audit event or user account.

The launch is one organization, one center branch, one teacher, one subject, and one 2026/27 Third Secondary cohort. Nevertheless, organization, branch, academic year, grade, subject, term, teacher, course, product, identifier, assessment, entitlement, and report relationships must be represented as data. Do not encode the pilot as singleton assumptions or TypeScript constants.

### 16.2 Modular-monolith domains

| Module                 | Owns                                                                                                                                                                                                                 | Runtime collaboration required through public application services/read ports/events |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Identity               | Closed staff/roster provisioning, one-use activation, phone/password login, old-password change, audited temporary-credential reset, staff TOTP, sessions and account lifecycle; future OTP adapter remains disabled | Access Control, Notifications, Audit                                                 |
| Access Control         | Roles, permissions, organization/branch scopes, guardian-child policies, authorization guards                                                                                                                        | Identity core IDs only                                                               |
| Students and Guardians | Profiles, guardian relationships, student identifiers, offline roster claim                                                                                                                                          | Identity, Academic Structure, Entitlements                                           |
| Academic Structure     | Organizations, branches, years, grades, cohorts, subjects, terms, official curriculum frameworks                                                                                                                     | None                                                                                 |
| Public Site/CMS        | Brand/site settings, teacher profile, public pages/blocks, marketing FAQ, testimonials/consent, legal document versions, policy acceptances                                                                          | Files, Identity, Audit                                                               |
| Catalog                | Courses, curriculum sections, lessons, resources, schedules, prerequisites, publication                                                                                                                              | Academic Structure, Files, Media                                                     |
| Curriculum Alignment   | Official Egyptian MoE objectives, teacher-enrichment objectives, content mappings, coverage metadata                                                                                                                 | Academic Structure, Catalog                                                          |
| Files                  | Upload intents, quarantine, malware scanning, file metadata, authorized delivery                                                                                                                                     | Identity/Access Control                                                              |
| Media                  | Manifested 720p/480p HLS assets, NGINX/R2 storage adapter, signed playback, activity leases, watermark payloads, watch events and transfer/storage telemetry                                                         | Catalog, Entitlements, Progress                                                      |
| Progress               | Lesson/course completion, resume, activity summaries, streak inputs                                                                                                                                                  | Catalog, Media, Assessments, Assignments                                             |
| Commerce               | Products, price versions, upgrade paths, orders, coupons, manual payment decisions, refunds, ledger                                                                                                                  | Students, Academic Structure, Files, Audit                                           |
| Entitlements           | Paid, roster, and manual access grants; activation, expiry, revocation                                                                                                                                               | Commerce, Catalog                                                                    |
| Assessments            | MCQ bank, passages, imports, blueprints, versions, attempts, answers, grading, release                                                                                                                               | Curriculum Alignment, Catalog, Progress                                              |
| Assignments            | Subjective typed/image/PDF submissions, rubrics, queues, grading, annotations                                                                                                                                        | Catalog, Files, Notifications                                                        |
| Practice               | Filtered MCQ practice, scoring, explanations, remediation                                                                                                                                                            | Assessments, Progress                                                                |
| Questions              | Private student questions, academic replies, moderation, anonymous publication                                                                                                                                       | Catalog, Files, Notifications                                                        |
| Reports                | Dashboards, monthly snapshots, operational exports                                                                                                                                                                   | Read models from relevant domains                                                    |
| Notifications          | In-app events/templates/preferences only at V1; disabled provider ports reserve future SMS/email integration without launch credentials or sends                                                                     | Transactional outbox                                                                 |
| Audit                  | Immutable staff/business events and tamper-evidence                                                                                                                                                                  | Identity IDs, no mutable domain dependency                                           |
| Operations             | Idempotency records, transactional outbox, jobs, feature flags, deletion/retention orchestration                                                                                                                     | All modules through published commands/events                                        |

The third column describes runtime collaboration, **not** an allowed compile-time import graph. Domain modules never import another module's Prisma repository, ORM model, controller, or private service. Each exposes narrow command/read ports plus versioned event contracts; multi-domain use cases live in acyclic application-layer orchestrators such as `EnrollmentOrchestrator`, `CheckoutOrchestrator`, `PlaybackAuthorizationOrchestrator`, `AssessmentStartOrchestrator`, and `AccountDeletionOrchestrator`. An orchestrator may compose public ports and open the shared transaction boundary, while the participating domain modules keep their own policies/transition methods and receive only stable IDs/value objects. Synchronous authorization/correctness reads use named ports; asynchronous side effects use the transactional outbox. A business mutation and its audit/outbox rows commit in the same PostgreSQL transaction.

Enforce this boundary in CI with TypeScript project references plus an import-boundary/dependency-cycle rule (for example dependency-cruiser or equivalent): applications may point to packages, orchestrators may point to module public APIs, public APIs may point inward, and no package/module cycle or forbidden deep import is accepted. Generate and archive the dependency graph on every release so the apparently cyclic runtime relationships above cannot become circular NestJS/package imports.

### 16.3 Cross-cutting backend invariants

- Every owned aggregate carries `organizationId`; branch-owned aggregates also carry `branchId`. All repository methods require scope explicitly rather than adding it opportunistically in controllers.
- Every enrollment, course offering, roster entry, identifier, product, entitlement, assessment, attempt, and monthly report belongs to an academic cohort. A new year creates new records; it never overwrites 2026/27 history.
- Store instants as UTC `timestamptz`; interpret business schedules and calendar months using IANA `Africa/Cairo`, including daylight-saving changes.
- Use UUIDv7 primary keys. Public slugs, four-digit IDs, online IDs, order numbers, and references are alternate identifiers, never database keys or authorization credentials.
- Use integer minor units for EGP money and decimal/numeric earned/possible marks. Never use binary floating point for either.
- Use optimistic `version` fields on mutable content/settings and database row locks or serializable transactions for financial, attempt, device, guardian-link, and entitlement invariants.
- Published content, assessment versions, submitted answers, grades, ledger records, payment decisions, entitlement history, and audit events are append-only or versioned. Corrections create a new revision/event; they do not erase history.
- Added July targets use independent server flags: `assignments`, `published_faq`, `coupons`, `monthly_guardian_reports`, and `practice_bank`. Disabled means no new user entry/publication/redemption/session/report request, feature controllers return `404 FEATURE_NOT_AVAILABLE` where safe, generated clients expose no enabled navigation metadata, and ordinary queries omit the module. A UI-only flag is insufficient. Already committed data is never deleted or stranded: minimal read/export for its owner/operator plus shared reconciliation, grading of submitted work, reservation release/consumption, retention, audit, and recovery workers continue as explicitly required.
- P0 authorization, payment, entitlement, assessment, file, and audit code paths must not depend on an added-target flag. An assignment completion/submission condition may be a prerequisite only for another assignment item; a P0 lesson/MCQ/other always-enabled item cannot directly or transitively depend on an assignment. Disabling assignments removes assignment items from current availability/progress denominators without changing P0 unlocks. Publication and flag-disable impact validation enforce this invariant before commit.

## 17. REST API and Contract Conventions

### 17.1 Wire contract

- Base path is `/api/v1`; transport is JSON over REST. Do not introduce GraphQL for launch.
- JSON fields are camelCase. Instants are ISO-8601 UTC. Date-only academic values use `YYYY-MM-DD`. Phone numbers are returned only where the caller has explicit PII permission.
- Successful singular responses use `{ "data": ... }`; collections use `{ "data": [...], "page": { "nextCursor": string | null, "hasMore": boolean } }`.
- Use opaque cursor pagination, default 25 and maximum 100. Each endpoint exposes an allowlist of filters and sort keys; never interpolate arbitrary client column names.
- Errors use `application/problem+json` with `type`, `title`, `status`, stable machine `code`, safe `detail`, optional `fieldErrors`, and `traceId`. Authentication/recovery responses must not reveal whether an unverified phone exists.
- Honor or create `X-Request-Id`. Include the same trace ID in logs, audit context, outbox metadata, and safe error responses.
- Generate OpenAPI from NestJS DTOs. CI must fail when the checked-in specification or generated clients differ from source.
- Mutable staff resources require expected `version`/`If-Match`; stale writes return `409 VERSION_CONFLICT` with the current version, not a silent last-write-wins update.
- Require `Idempotency-Key` on checkout/order creation, payment-proof finalization, payment/refund decisions, entitlement grants/revocations, assessment start/submit, assignment submit, report/export creation, and future payment webhooks. Store principal, method, route template, request hash, status, and result reference. Reusing a key with different input returns `409 IDEMPOTENCY_KEY_REUSED`.
- Generic `PATCH status` endpoints are forbidden. Expose named commands such as `publish`, `approve`, `reject`, `reverse`, `void`, or `revoke`, each with its own permission, validation, audit event, and allowed transition.
- State-changing browser calls require a validated exact Origin plus a session-bound CSRF token header. CORS permits only the configured academy and staff origins with credentials.

### 17.2 Endpoint surface

The paths below are the minimum contract. Equivalent NestJS controller grouping is allowed; behavior and authorization are not optional.

**Public catalog and settings**

- `GET /public/academy`
- `GET /public/site-settings`, `GET /public/pages/{slug}`, `GET /public/testimonials`
- `GET /public/legal/current` and `GET /public/legal/{type}/{version}`
- `GET /public/academic-structure`
- `GET /public/products`
- `GET /public/products/{productSlug}` — canonical storefront detail backing `/courses/{productSlug}`
- `GET /public/courses` and `GET /public/courses/{courseSlug}` — unpriced academic summaries used inside product details; never a checkout target
- `GET /public/preview-lessons/{lessonSlug}`
- `POST /public/preview-lessons/{lessonSlug}/playback-sessions`
- `POST /public/preview-playback-sessions/{id}/renew` and `DELETE /public/preview-playback-sessions/{id}`
- `POST /public/checkout/quote` for display only; authenticated checkout always recalculates

**Authentication and account lifecycle — Lean V1**

- `POST /auth/activations/start`, `POST /auth/activations/{sessionId}/complete` accept normalized phone plus a separate high-entropy one-use activation credential, then set the initial password and consume the credential transactionally. They are enumeration-safe and work only for pre-created student/guardian/staff invitations.
- `POST /auth/offline-claim/start`, `/resume`, `/set-password`, and `/finalize` use the roster phone plus separate activation credential; there is no OTP endpoint or public account creation.
- `POST /auth/login`
- `POST /auth/staff/totp/verify`
- `GET /auth/session`
- `GET /auth/csrf`
- `POST /auth/logout`
- `POST /auth/logout-all`
- `POST /auth/password/change` for an authenticated account using current password; staff also supplies recent TOTP
- `POST /auth/staff/totp-enrollments/start`, `POST /auth/staff/totp-enrollments/{id}/prove`, and `POST /auth/staff/totp-enrollments/{id}/acknowledge-complete` implement the short-lived pending-secret ceremony for initial, recovery, and forced reenrollment; there is no single ambiguous enroll/replace call
- `POST /auth/staff/invitations/accept/start` and `/complete` for a pending invited staff account; every route is behind Cloudflare Access, requires the exact frozen Access identity, consumes the app activation credential, and completes password, TOTP and recovery-code setup without claiming phone verification
- `POST /auth/staff/totp/recover` using password plus one unused recovery code, followed immediately by replacement TOTP enrollment
- `POST /auth/staff/recovery-codes/regenerate`

**Student and guardian self-service**

- `GET /me`; `PATCH /me/profile` is expected-version and persona-allowlisted to display name, locale, theme/data-saver and nonmandatory delivery preferences only. Unknown fields reject. It cannot mutate phone, verified/pending email, password, account kind/status, roles, guardian links, cohort/membership, identifiers, devices, policy/marketing/testimonial consent, or security settings; those use named workflows. A display-name change invalidates any exact public-name consent projection.
- `GET /me/devices` (student read-only)
- `GET /me/security-events`
- `GET /me/guardian-links`
- `POST /me/guardian-link-invitations`
- `POST /guardian-link-acceptance/start` and `/complete` use the guardian's own opaque one-use invitation/activation credential plus password setup or an authenticated existing guardian; no phone/email verification claim is created
- `GET /guardian/link-invitations` and `POST /guardian/link-invitations/{id}/accept` for an already authenticated guardian
- `POST /guardian/links/{id}/revoke-self` for a secondary guardian; primary transfer uses the guarded staff/current-primary flow below
- `POST /guardian/children/{studentId}/primary-transfer-cases` and named `/complete|cancel` commands are current-primary-only and bind current session/password, exact child/current/replacement link versions, and an active replacement secondary; higher-risk staff fallback uses the manual identity case
- `GET /guardian/primary-transfer-cases` and `POST /guardian/primary-transfer-cases/{caseId}/accept` let only the frozen replacement guardian accept with recent password/session; knowing a case ID grants nothing
- `POST /me/deletion-request`
- `POST /me/deletion-request/cancel`
- `POST /me/data-exports`, `GET /me/data-exports`, `GET /me/data-exports/{id}`, and `GET /me/data-exports/{id}/download`
- `GET /guardian/children`
- `GET /guardian/children/{studentId}/dashboard`
- `GET /guardian/children/{studentId}/courses`
- `GET /guardian/children/{studentId}/grades`
- `GET /guardian/children/{studentId}/payments`
- `GET /guardian/children/{studentId}/reports`
- `POST /guardian/children/{studentId}/orders`

**Student, guardian, roster, and staff administration**

- `GET /staff/students` and `GET /staff/students/{id}`
- `POST /staff/students/{id}/suspend|reactivate|block|unblock` are convenience aliases only: resolve the student's account then invoke the exact same permissioned/reasoned/recent-TOTP/`If-Match`/idempotent account lifecycle command, deletion-restoration lock and audit path below; no second implementation or weaker DTO exists
- `POST /staff/students/{id}/devices/{deviceId}/revoke`
- `POST /staff/accounts/{id}/password-reset-cases`, `GET /staff/password-reset-cases/{caseId}`, and named `/approve|issue-temporary|cancel` commands implement the manual V1 recovery ceremony. `issue-temporary` revokes sessions, hashes a server-generated one-use credential, returns it once, and sets `MUST_CHANGE_PASSWORD`; no request field accepts a staff-chosen password.
- `POST /staff/accounts/{id}/contact-correction-preview|contact-correction` is the only V1 phone/email mutation, requires manual identity evidence, collision/version preview, recent staff TOTP and reason, and leaves the corrected channel explicitly unverified.
- `POST /staff/identity-recovery-cases`, `GET /staff/identity-recovery-cases/{id}`, and named `/approve|reject` commands dispatch from the case's immutable method. `IN_PERSON_ORIGINALS_TWO_STAFF` accepts only the bounded document-category/pre-existing-record attestation; `STAFF_FACTOR_OTHER_OWNER` accepts only target-factor proof plus the different-owner approval and rejects all in-person-evidence fields. Staff can make a case eligible but cannot consume the new-phone OTP or complete the account change; no one-step override exists.
- `POST /staff/students/{id}/entitlements/preview` creates a short-lived frozen product-boundary or exact-exception impact/closure preview; `POST /staff/students/{id}/entitlements` requires that preview hash/version, idempotency, permission and reason
- `POST /staff/students/{id}/guardian-link-invitations`
- `POST /staff/students/{id}/guardian-primary-transfer-cases` creates the staff-fallback case after recent TOTP, explicit permission/reason, and exact link-version preview; the replacement guardian must still use the authenticated acceptance command, and staff completes only a `READY` case
- `POST /staff/guardian-primary-transfer-cases/{caseId}/complete|cancel` requires the same permission, recent TOTP, expected case/link versions, and reason; it cannot bypass the replacement's authenticated acceptance or complete a current-primary-initiated case
- `POST /staff/students/{id}/guardian-links/{linkId}/revoke`
- `POST /staff/entitlements/{id}/revoke`
- `POST /staff/roster-imports`
- `GET /staff/roster-imports/{id}`
- `POST /staff/roster-imports/{id}/commit`
- `POST /staff/rosters/codes/generate`
- `POST /staff/rosters/exports`
- `GET /staff/roster-entries`
- `POST /staff/roster-entries/{id}/void` and `/release-expired-claim` are named versioned commands; a live valid claim cannot be stolen or voided by a generic edit
- `GET /staff/roster-claim-conflicts`, `GET /staff/roster-claim-conflicts/{id}`, and named `/resolve-attach|reject-release|void-entry` commands operate only on the frozen proven candidate/account and never perform a free-form account merge
- `GET /staff/accounts` and `GET /staff/accounts/{id}` are scoped reads; `PATCH /staff/accounts/{id}/profile` may change only allowlisted nonsecurity display/support metadata with expected version
- `POST /staff/accounts/{id}/suspend|reactivate|block|unblock` are named, reasoned commands requiring the exact permission and recent TOTP; owner-set locking prevents the last active owner from being made unavailable
- No generic `POST /staff/accounts` or account/status/phone/security `PATCH` exists. Production account creation is exclusively the one-time operations-shell first-owner bootstrap or a verified invitation/acceptance workflow; phone recovery, TOTP reenrollment, roles, and lifecycle transitions remain their named commands
- `POST /staff/invitations`, `GET /staff/invitations`, and `POST /staff/invitations/{id}/resend|revoke`
- `POST /staff/accounts/{id}/require-totp-reenrollment` for an authorized higher-trust recovery flow; it never directly sets or reveals a TOTP secret
- `POST/DELETE /staff/accounts/{id}/roles/{roleId}`
- `GET /staff/roles` and `GET /staff/permissions`

**Curriculum, catalog, content, and files**

- Versioned owner/administrator CRUD under `/staff/branches`, `/staff/academic-years`, `/staff/grades`, `/staff/subjects`, `/staff/cohorts`, and `/staff/terms`, with named `/impact-preview`, `/archive`, and `/reactivate` commands. Referenced academic-structure rows are never hard-deleted or edited in a way that rewrites history.
- `POST /staff/cohort-promotions` creates a frozen preview batch from an explicit source cohort/branch to target cohort/branch; `GET /staff/cohort-promotions/{id}` returns row conflicts and identifier/access consequences; `POST /staff/cohort-promotions/{id}/commit` is versioned, idempotent, audited, and never carries a paid entitlement unless an explicit new assignment says so.
- Named `POST /staff/cohort-promotions/{id}/schedule-activation|cancel-activation|activate` commands set a Cairo activation instant, unschedule it, or trigger manual activation. `cancel-activation` is allowed only before any item activates and returns `ACTIVATION_SCHEDULED -> COMMITTED` while preserving every `PLANNED` target membership/identifier for later rescheduling. `POST /staff/cohort-promotions/{id}/cancel-batch` is allowed only while `DRAFT_VALIDATING/READY`, before commit, and records `CANCELLED`; committed rows are never deleted or identifier values recycled. Named `POST /staff/cohort-promotions/{id}/items/{itemId}/repreview|retry` commands refresh a `BLOCKED_DRIFT` item's explicit proposed versions/impact, then retry only that item after authorized confirmation. No generic batch/item-state patch exists.
- Versioned staff CRUD under `/staff/curriculum-frameworks`, `/staff/curriculum-objectives`, `/staff/courses`, `/staff/curriculum-sections`, `/staff/learning-items`, and `/staff/lessons`
- Explicit `/schedule`, `/unschedule`, `/publish`, `/archive`, and reorder commands; `unschedule` is valid only before the due publication job claims the version and atomically returns it to draft
- CRUD `/staff/learning-items/{id}/prerequisites`
- CRUD `/staff/learning-items/{id}/curriculum-mappings`
- CRUD `/staff/lessons/{id}/resources`
- `POST /staff/media-assets` to create a provider/resumable-upload record; `GET /staff/media-assets`, `GET /staff/media-assets/{id}`, and named `/retry|reconcile` commands
- `GET/POST /staff/lessons/{id}/media-versions` and named `/impact-preview|activate|retire` commands; in-place asset replacement is forbidden
- `POST /staff/media-import-batches`, `GET /staff/media-import-batches/{id}`, `GET /staff/media-import-batches/{id}/items`, and named item/batch `/retry|validate|commit` commands using checksum manifests
- `POST /uploads`, `POST /uploads/{id}/complete`, `GET /uploads/{id}`
- `GET /files/{id}/view`; `GET /files/{id}/download` only for explicitly downloadable material
- `GET /student/courses`, `GET /student/courses/{courseId}/curriculum`, `GET /student/lessons/{lessonId}`

**Public CMS, teacher profile, testimonials, and legal content**

- Versioned staff CRUD/preview plus named `/schedule|unschedule|publish|archive` commands under `/staff/site-settings`, `/staff/public-pages`, `/staff/teacher-profile`, `/staff/marketing-faq`, `/staff/testimonials`, and `/staff/legal-documents`; unschedule succeeds only before the due job claim and never mutates a published revision.
- `POST /staff/testimonials/{id}/verify-consent|publish|reject|withdraw`; consent evidence remains private.
- `GET /me/policy-acceptances`; registration, guardian acceptance, and order creation carry the exact current required policy-version IDs and record acceptance within their domain transaction rather than through a forgeable standalone checkbox call.

**Playback and progress**

- `POST /student/lessons/{lessonId}/playback-sessions`
- `POST /student/playback-sessions/{id}/heartbeat`
- `POST /student/playback-sessions/{id}/events`
- `DELETE /student/playback-sessions/{id}`
- `POST /student/lessons/{lessonId}/complete` is an idempotent explicit command available only when that lesson's immutable completion mode is `MANUAL_ACK`; it rejects video/pass-linked lessons and never treats a file open as completion
- `GET /student/lessons/{lessonId}/progress`
- `GET /student/dashboard`

**Commerce and entitlements**

- `GET /products`
- `POST /checkout/quote`
- `POST /orders`
- `GET /orders` and `GET /orders/{id}`
- `POST /orders/{id}/payment-submissions`
- `GET /payment-submissions/{id}`
- Staff CRUD under `/staff/products`, `/staff/product-upgrade-paths`, and `/staff/coupons`; products use named `/publish|pause|resume|archive` commands and coupons use named `/activate|deactivate|archive` commands. Time-derived expiry is worker-enforced/read-time-enforced and no generic state patch exists.
- `GET/POST /staff/payment-destinations`, `GET /staff/payment-destinations/{id}`, and named `/preview-impact|activate|retire` commands are restricted to owner/administrator `payment_destination.manage`; generic edit/activation by finance is forbidden
- `GET /staff/payment-submissions`
- `POST /staff/payment-submissions/{id}/claim|renew-claim|release-claim|reassign|approve|reject`
- `POST /staff/payments/{paymentId}/reverse` with idempotency, recent TOTP, structured reason/evidence, and dependency preflight
- `POST /staff/payments/{id}/refunds`
- `POST /staff/refunds/{id}/complete|reject|cancel`
- `GET /staff/manual-payment-exceptions` and `POST /staff/manual-payment-exceptions/{id}/mark-return-pending|mark-returned|resolve`
- `GET /staff/funding-adjustment-cases` and named `/top-up-order`, `/unwind`, and `/resolve` commands; `resolve` only confirms an already reconciled invariant and generic state edits are forbidden
- `GET /staff/financial-reports`

**MCQ assessments and question bank**

- Versioned staff CRUD/publish under `/staff/mcq-question-groups`, `/staff/mcq-questions`, `/staff/assessment-blueprints`, and `/staff/assessments`
- `POST /staff/mcq-question-imports`, `GET /staff/mcq-question-imports/{id}`, `POST /staff/mcq-question-imports/{id}/commit`
- `GET /student/assessments/{id}`
- `POST /student/assessments/{id}/attempts`
- `GET /student/assessment-attempts/{id}`
- `PUT /student/assessment-attempts/{id}/answers/{attemptQuestionId}`
- `POST /student/assessment-attempts/{id}/events`
- `POST /student/assessment-attempts/{id}/submit`
- `GET /student/assessment-attempts/{id}/result`
- `POST /staff/assessment-attempts/{id}/void`
- `POST /staff/assessment-attempts/{id}/regrade` is a versioned/idempotent academic/owner correction command using only allowlisted deterministic operations against the frozen snapshot; it accepts no arbitrary final mark and records old/new result revisions plus reason
- `POST /staff/assessments/{id}/attempt-authorizations`
- `POST /staff/assessments/{id}/result-release-batches/preview`, `POST /staff/assessments/{id}/result-release-batches`, `GET /staff/result-release-batches/{id}`, and named `/retry-blocked|cancel-before-start` commands implement `MANUAL` release from a frozen eligible result-revision set
- `POST /staff/assessment-results/exports`

**Added July targets**

- Assignments: staff versioned CRUD/publish; `POST /student/assignments/{id}/attempts`, `GET /student/assignment-attempts/{id}`, optimistic/idempotent `PUT /student/assignment-attempts/{id}/draft`, purpose-bound draft attachment add/remove, and named `/submit`; staff grading queue/claim/review/finalize/return under `/staff/assignments` and `/staff/grading-queue`. Draft save and submit are distinct commands.
- Practice: filters, start/resume/answer/finish under `/student/practice`.
- Published FAQ: publication/search alone is gated; moderation/publish/withdraw uses `/staff/student-questions/{id}/published-entry` and entitled-student search uses `/student/lessons/{lessonId}/published-questions`.
- Coupons: staff CRUD and checkout redemption are gated even though the commerce schema exists.
- Monthly reports: student/guardian history, staff generation, and delivery endpoints are gated under `/student/reports`, `/guardian/children/{id}/reports`, and `/staff/reports`.

**Private academic questions and verified course reviews**

- `GET/POST /student/questions`, `GET /student/questions/{id}`, `POST /student/questions/{id}/close|withdraw`, and upload attachment through the purpose-bound upload flow. Every student query is owner-scoped; withdrawal is a named privacy command, not a generic delete.
- `GET /staff/student-questions`, `GET /staff/student-questions/{id}`, `POST /staff/student-questions/{id}/replies`, and `POST /staff/student-questions/{id}/close|reopen|remove` for academic/owner permission. Removal requires an allowlisted privacy/abuse/wrong-course/copyright reason and an expected version. These P0 routes do not depend on the published-FAQ flag.
- `POST /staff/student-questions/exports` requires `academic.question_export`, recent TOTP, explicit course/cohort/date scope and reason; it produces only formula-safe PDF/XLSX with pseudonymous student ID, question/reply/status/times and no name, phone, email, guardian data, private attachment, or signed link. The encrypted export expires after 24 hours and every create/download is audited.
- `GET/PUT /student/courses/{courseId}/review`, `POST /student/courses/{courseId}/review/submit|withdraw`.
- `POST /student/courses/{courseId}/review/display-consent/accept|withdraw` for the exact approved review revision and displayed short-name string.
- `GET /guardian/children/{studentId}/course-reviews/{reviewId}/display-consent` and `POST .../accept|withdraw` for the current active primary guardian only; consent binds review revision, display string, and primary-link version.
- `GET /staff/course-reviews`, `GET /staff/course-reviews/{id}`, and `POST /staff/course-reviews/{id}/approve|reject|withdraw`.

**Notifications, support, audit, and exports**

- `GET /notifications`, `POST /notifications/{id}/read`
- Versioned staff announcement CRUD plus named `preview-audience`, `test-send`, `schedule`, `unschedule`, `send-now`, and `cancel` commands under `/staff/announcements`; unschedule returns a due-unclaimed scheduled revision to draft, while cancel is terminal and delivery status is read-only
- `POST/GET /support/tickets`, `GET /support/tickets/{id}`, `POST /support/tickets/{id}/messages`, and named `/resolve|reopen` for the creating student/guardian within section 20.7 scope
- `GET /staff/support/tickets`, `GET /staff/support/tickets/{id}`, and named `/claim|assign|reply|internal-note|wait-for-user|resolve|reopen|escalate` commands; every command has its own permission and expected version
- `POST /staff/exports`, `GET /staff/exports/{id}`
- `GET /staff/audit-events`
- Internal health endpoints expose only readiness state, never secrets, queue payloads, versions, or hostnames

**Operational controls and restricted-production admission**

- `GET /staff/feature-flags` and named `POST /staff/feature-flags/{code}/enable|disable` commands manage only the five optional modules. Unknown codes and generic value patches fail.
- `GET /staff/operational-controls` and named `POST /staff/operational-controls/{code}/close|reopen` commands manage the eight kill switches. Every mutation requires owner permission, recent non-replayed TOTP, `If-Match`, idempotency key, reason, and incident/release evidence; closing/reopening audits/outboxes after commit.
- `GET /staff/admission-control` and named `POST /staff/admission-control/open-public|restrict` commands require the signed release/rollback record and the same concurrency protections. Public mode bypasses only pilot membership, never ordinary authentication/authorization.
- `GET/POST /staff/pilot-access`, `POST /staff/pilot-access/{id}/revoke`, `POST /staff/pilot-access-imports`, `GET /staff/pilot-access-imports/{id}`, and named `/validate|commit` commands are owner-only, versioned/idempotent. Bulk input is JSON only at launch, maximum 100 rows of account ID or phone plus persona/scope/expiry/reason—no spreadsheet/file upload. Phones normalize inside the request and persist only as HMAC/safe last-four. Responses never expose plaintext phones or imply direct SQL.

## 18. Database and Schema Conventions

- Generate UUIDv7 IDs in the application and never expose sequential database IDs.
- All mutable domain rows include `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, and integer `version`; append-only rows omit meaningless update fields.
- Every unique business key includes its organization/cohort/branch scope as appropriate. Slug/code uniqueness must not accidentally prevent a future cohort from reusing a sensible label.
- Use database `CHECK` constraints for amount ranges, dates, identifier formats, option counts, state-independent invariants, and nonnegative marks. Use foreign-key `RESTRICT` on finance, audit, entitlement, attempt, and published-version history.
- Use normalized Arabic/English search columns with Unicode normalization, Arabic diacritic removal, whitespace folding, and case folding. Index staff searches with PostgreSQL `pg_trgm`; exact phone/payment-reference lookup uses keyed hashes, not plaintext.
- Calculated percentages and dashboards are rebuildable read models. Authoritative inputs are watched ranges, item completion, answer/submission records, earned/possible marks, ledger entries, and entitlement states.
- Migrations must seed stable role/permission codes and the pilot academic structure without seeding fabricated prices, biography, claims, payment destinations, legal text, or testimonials.

## 19. Entity Catalog, Constraints, and Indexes

The names below are canonical conceptual entities. Prisma model naming may follow repository conventions, but it must preserve these boundaries, fields, constraints, and historical records.

### 19.1 Organization, cohort, and curriculum provenance

| Entity                           | Required fields                                                                                                                                                                    | Required constraints/indexes                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organizations`                  | `id`, name, default timezone, currency, status                                                                                                                                     | Seed one active academy; timezone `Africa/Cairo`, currency `EGP`                                                                                                 |
| `branches`                       | `organizationId`, stable code, localized name, status, contact/address settings                                                                                                    | Unique `(organizationId, code)`; seed the single center; keep branch data-driven                                                                                 |
| `academic_years`                 | organization, label, `startsOn`, `endsOn`, status                                                                                                                                  | `startsOn < endsOn`; unique label/organization                                                                                                                   |
| `grades`                         | organization, stable code, localized name, sort, status                                                                                                                            | Unique code/organization; seed Third Secondary only as active pilot data                                                                                         |
| `subjects`                       | organization, stable code, localized name, status                                                                                                                                  | Unique code/organization; seed English                                                                                                                           |
| `cohorts`                        | organization, academic year, grade, `startsAt`, `expiresAt`, status                                                                                                                | Unique year/grade/organization; every product/access record references a cohort                                                                                  |
| `terms`                          | cohort, stable code, localized title, start/end, sort, status `ACTIVE/ARCHIVED`                                                                                                    | Dates inside cohort; unique code/cohort; referenced term may be archived/reactivated by named versioned command but never hard-deleted or silently moved         |
| `teachers`                       | organization, account/profile reference where applicable, localized public metadata reference, status                                                                              | Courses use a join table so later teachers do not require schema changes                                                                                         |
| `curriculum_frameworks`          | organization, academic year, grade, subject, `sourceType`, source title/version/publication date, official source URL or owner-uploaded reference, verification actor/time, status | `sourceType = MOE_OFFICIAL/TEACHER_ENRICHMENT`; unique source version within grade/subject/year; official and enrichment records can never be silently relabeled |
| `curriculum_objectives`          | framework, stable objective code, optional parent, term/unit metadata, localized description, sort                                                                                 | Unique code/framework; parent in same framework; acyclic hierarchy                                                                                               |
| `learning_item_curriculum_links` | learning item, objective, contribution type, coverage weight/notes                                                                                                                 | Unique item/objective; contribution is `OFFICIAL_CORE`, `OFFICIAL_SUPPORT`, or `TEACHER_ENRICHMENT`                                                              |
| `question_curriculum_links`      | question, objective, contribution type, cognitive skill, optional notes                                                                                                            | Unique question/objective; indexed objective/difficulty/type for blueprint selection                                                                             |

The platform must distinguish official Egyptian Ministry of Education curriculum alignment from Mr. Bahrawy's enrichment. Official alignment is recorded by framework source/version and objective code; teacher enrichment is stored under a separate provenance type and must never be presented as Ministry-issued content. A curriculum source update creates a new framework version and mappings; it does not rewrite attempts or past coverage reports. The system stores source metadata and academy-authored mappings, not an assumption that all source documents may be republished.

### 19.2 Identity, guardian, staff, session, and roster entities

| Entity                                               | Required fields                                                                                                                                                                                                                                                                                                      | Required constraints/indexes                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `accounts`                                           | organization, kind, nullable encrypted phone and phone lookup HMAC after anonymization, `phoneVerificationState`, optional encrypted email/email HMAC, `emailVerificationState`, password hash, `mustChangePassword`, locale, status, deletion due time                                                              | Kind `STUDENT/GUARDIAN/STAFF`; every V1 phone is stored as `UNVERIFIED_V1`; email is optional and `UNVERIFIED_V1`; phone is the login identifier; partial unique `(organizationId, phoneLookupHmac)` for every state except `ANONYMIZED`; no UI/API may imply either contact is verified or use email for login/recovery/delivery                                                                                                        |
| `account_activations`                                | account, source `STAFF/ROSTER/GUARDIAN/STAFF_INVITE`, credential hash, issued actor/time, expiry, consumed/revoked time, failed-attempt count, safe delivery note                                                                                                                                                    | Account must already exist; credential is high entropy, one-use, short-lived, shown to authorized staff once and never logged; one live activation/account; completion locks account, verifies phone equality without claiming ownership verification, sets password, consumes credential and opens the first approved-device slot atomically                                                                                            |
| `contact_correction_cases`                           | account, old/new encrypted contact snapshots and lookup HMACs, kind `PHONE/EMAIL`, evidence checklist, initiating/approving staff, reason, state/version, completion time                                                                                                                                            | Staff-only V1 workflow; recheck global phone uniqueness at commit; corrected contacts remain `UNVERIFIED_V1`; revoke all sessions after a phone correction; never store document images/numbers or payment-proof contents as identity evidence                                                                                                                                                                                           |
| `student_profiles`                                   | account, display name, normalized search name, support metadata                                                                                                                                                                                                                                                      | One-to-one student identity; academic year/branch/source live in immutable membership history, not mutable profile fields                                                                                                                                                                                                                                                                                                                |
| `student_cohort_memberships`                         | student, cohort, branch, source `ONLINE/OFFLINE`, start/end, status `PLANNED/ACTIVE/COMPLETED/WITHDRAWN`, creator/source reference                                                                                                                                                                                   | One current active membership/student; unique student/cohort/branch; promotion creates a new row and ends the prior row without rewriting history                                                                                                                                                                                                                                                                                        |
| `cohort_promotion_batches`, `cohort_promotion_items` | organization, source/target cohort and branch, selection criteria/version, immutable candidate snapshot, per-student source-membership version/new identifier/access decision, validation result, Cairo `activationAt`, batch/item state, claim lease, attempt/error, actor/times                                    | Batch `DRAFT_VALIDATING/READY/COMMITTED/ACTIVATION_SCHEDULED/ACTIVATING/ACTIVATED/ACTIVATED_WITH_BLOCKS/FAILED/CANCELLED`; item `READY/PLANNED/ACTIVATED/BLOCKED_DRIFT`; `CANCELLED` is pre-commit only; unscheduling returns to `COMMITTED` and preserves planned rows; one committed item per source membership/target cohort; preview/commit hashes match; commit is idempotent/audited and activation records every per-item outcome |
| `student_identifiers`                                | student, membership, branch, cohort, kind, display code, issued time                                                                                                                                                                                                                                                 | Offline code is exactly `0001`-`9999`, excluding `0000`, unique `(branchId, cohortId, code)`; online code is numeric `>10000`, unique `(organizationId, cohortId, code)`; unique `(membershipId, kind)` prevents two identifiers of the same kind on one membership                                                                                                                                                                      |
| `guardian_profiles`                                  | account, display name, delivery preferences                                                                                                                                                                                                                                                                          | One-to-one guardian account                                                                                                                                                                                                                                                                                                                                                                                                              |
| `student_guardians`                                  | student, guardian, relationship label, role, status, verified/created/revoked times and actors                                                                                                                                                                                                                       | Role `PRIMARY/SECONDARY`; one active primary and maximum two active guardians/student; same guardian may link many students                                                                                                                                                                                                                                                                                                              |
| `guardian_link_invitations`                          | student, proposed role/relation, pre-created guardian account, invited phone HMAC, activation credential hash, inviter, expiry, state, accepted guardian/time                                                                                                                                                        | One live invitation per student/role/phone; guardian phone must match the staff-approved record; credential is one-use and never logged; link is created only after guardian account activation/password setup; contact remains `UNVERIFIED_V1`                                                                                                                                                                                          |
| `guardian_primary_transfer_cases`                    | student, frozen current-primary and replacement-secondary link IDs/versions, initiation path `CURRENT_PRIMARY/STAFF`, authenticated current-primary approval or staff authorization, replacement acceptance, state/version, expiry, completion actor/time                                                            | Replacement must already be an active secondary; one live case/student; completion locks child and both links and can never commit zero/two primaries; no OTP exists in V1                                                                                                                                                                                                                                                               |
| `staff_profiles`                                     | account, display name, staff status                                                                                                                                                                                                                                                                                  | One-to-one staff account                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `staff_invitations`                                  | organization, encrypted invited phone/HMAC, encrypted Cloudflare-Access email/email HMAC or approved IdP subject, proposed role/scope snapshot, credential hash, inviter, expiry, Access provisioning/effect state, accepted staff/time, state                                                                       | One live invitation/Access identity; 24-hour one-use credential; acceptance requires a valid Cloudflare Access assertion matching the frozen edge identity plus app password and TOTP enrollment; staff phone remains `UNVERIFIED_V1`; no active access until Access provisioning is confirmed                                                                                                                                           |
| `staff_access_identities`                            | staff account, provider `CLOUDFLARE_ACCESS`, encrypted email/HMAC or immutable IdP subject, Access audience, provisioned/verified/revoked times, provider-effect reference, state                                                                                                                                    | One active identity/staff and unique active provider subject/email; it is an edge identity only, never the academy login identifier; suspension/block/deletion/role loss denies app authorization immediately and queues Access-policy removal/reconciliation                                                                                                                                                                            |
| `roles`, `permissions`, `role_permissions`           | immutable stable codes and descriptions                                                                                                                                                                                                                                                                              | Seed roles `OWNER`, `ADMINISTRATOR`, `CONTENT`, `ACADEMIC`, `FINANCE`, `SUPPORT`, `ANALYST`; migrations own code changes                                                                                                                                                                                                                                                                                                                 |
| `account_roles`                                      | staff account, role, optional branch scope, grant/revoke actors/times                                                                                                                                                                                                                                                | Unique active assignment; only owner/administrator with explicit role-management permission may mutate                                                                                                                                                                                                                                                                                                                                   |
| `approved_devices`                                   | student, slot `1/2`, device token hash, user-agent summary, display label, first/last seen, revoked actor/time/reason                                                                                                                                                                                                | Partial unique active `(studentId, slot)`; activation locks student row; clearing cookie is a new device                                                                                                                                                                                                                                                                                                                                 |
| `auth_sessions`                                      | account, optional approved device, token hash, issued/idle/absolute expiry, last seen, revoke time/reason                                                                                                                                                                                                            | Unique token hash; indexes account/expiry; PostgreSQL authoritative                                                                                                                                                                                                                                                                                                                                                                      |
| `password_reset_cases`                               | target account, initiating and optional approving staff, identity checklist, reason, state/version, temporary-credential hash/expiry/consumed time, session-revocation time                                                                                                                                          | Customer-service initiated; server generates a high-entropy one-use credential and shows it once; staff never chooses/sees a permanent password; issuance revokes all sessions and sets `mustChangePassword`; caller ID, WhatsApp possession, name/code knowledge, or a payment screenshot alone is insufficient                                                                                                                         |
| `student_activity_leases`                            | student primary key, session/device, kind `LEARNING/EXAM`, token hash, heartbeat and expiry                                                                                                                                                                                                                          | At most one live activity/student; server renews only for owning session/device                                                                                                                                                                                                                                                                                                                                                          |
| `future_otp_challenges`                              | **Not created by V1 migrations**; reserved future purpose/phone/provider-reference contract                                                                                                                                                                                                                          | Implement only in a separately approved OTP release with migration, UI copy, provider approval, rate/spend limits and verification campaign; never backfill fake verification timestamps                                                                                                                                                                                                                                                 |
| `totp_factors`                                       | staff account, encrypted/versioned secret, activation/revoke time, last accepted time-step                                                                                                                                                                                                                           | Exactly one active factor/staff; accepting login/reauth compares-and-advances the step transactionally so the same code/window cannot succeed twice                                                                                                                                                                                                                                                                                      |
| `totp_enrollment_sessions`                           | staff, purpose `INITIAL/RECOVERY/FORCED_REENROLL`, prerequisite-proof reference, encrypted pending secret/version, opaque session token hash, state `ISSUED/PROVEN/ACKNOWLEDGED/CONSUMED/EXPIRED`, proven step, expiry/consumed times                                                                                | One live/staff; 15-minute one-use session; pending secret/recovery-code material never authenticates before atomic completion and purges on expiry; concurrent completion can activate exactly one factor version                                                                                                                                                                                                                        |
| `staff_recovery_codes`                               | staff, code hash, generated/consumed times                                                                                                                                                                                                                                                                           | Atomic one-time consumption                                                                                                                                                                                                                                                                                                                                                                                                              |
| `security_events`                                    | account or phone HMAC, event type/outcome, device/IP-safe metadata, time                                                                                                                                                                                                                                             | Append-only; indexes account/time and type/time                                                                                                                                                                                                                                                                                                                                                                                          |
| `identity_recovery_cases`                            | target account/kind, method `V1_MANUAL_PASSWORD_RESET/V1_CONTACT_CORRECTION/STAFF_FACTOR_OTHER_OWNER/CONSOLE_BREAK_GLASS`, branch, pre-existing roster/link/enrollment record IDs, non-sensitive checklist flags, initiating/distinct approving actors where policy requires, state/version, expiry/cooldown, result | V1 student/guardian recovery routes only to `password_reset_cases` or `contact_correction_cases`; no OTP or automated forgot-password path; staff-factor recovery requires another owner or console break-glass; every transition is audited and one-use                                                                                                                                                                                 |
| `roster_batches`                                     | branch, cohort, source/import file, creator, validation/finalization status                                                                                                                                                                                                                                          | A finalized batch is immutable; every export references batch/version                                                                                                                                                                                                                                                                                                                                                                    |
| `offline_roster_entries`                             | batch, branch, cohort, student search/display name, encrypted phone/HMAC, guardian contacts, four-digit identifier, claim state, claimed student                                                                                                                                                                     | Code `0001`-`9999`; unique branch/cohort/code; matching-phone and claim-state indexes                                                                                                                                                                                                                                                                                                                                                    |
| `roster_claim_sessions`                              | roster entry, pre-created student account, activation credential hash, accepted guardian, device intent, state, created/last-step/reservation/max-expiry times                                                                                                                                                       | At most one active session/entry; created by staff/finalized import, not public discovery; requires matching normalized phone plus one-use credential; no OTP; identifier alone reveals nothing; abandoned credentials expire and are revocable                                                                                                                                                                                          |
| `roster_product_assignments`                         | finalized roster entry, product/version, price-independent access start/end, immutable content-boundary snapshot and explicit-item snapshot, assignment actor/source                                                                                                                                                 | Frozen when the roster batch is finalized; uniquely assigned per entry/product; successful claim copies this exact snapshot into entitlement grants rather than rereading the mutable catalog                                                                                                                                                                                                                                            |
| `roster_claim_events`                                | roster entry, account/challenge/device where known, outcome, time                                                                                                                                                                                                                                                    | Append-only support/fraud history                                                                                                                                                                                                                                                                                                                                                                                                        |
| `roster_claim_conflicts`                             | entry, claim session, type, frozen phone/cohort/person-match facts and proven existing candidate account, state `OPEN/ATTACHED_PROVEN_ACCOUNT/REJECTED_RELEASED/VOIDED`, expected versions, reviewer/reason/times                                                                                                    | One open conflict/entry; no arbitrary target account; resolution requires roster permission, recent TOTP and exact candidate proof; every outcome locks entry/session/account and is audited                                                                                                                                                                                                                                             |
| `online_identifier_sequences`                        | organization, cohort, next number                                                                                                                                                                                                                                                                                    | Seed next number at `10001`; lock row during allocation; never decrement/reuse                                                                                                                                                                                                                                                                                                                                                           |

The four-digit offline identifier is searchable/displayed only with branch and cohort. Generate randomly or shuffled across the available `0001`-`9999` space, exclude every identifier already issued in that branch/cohort, never reuse a claimed/voided identifier, and return an explicit capacity error at 9,999 records. V1 activation requires a finalized roster entry, matching normalized phone, its separate one-use activation credential, password setup, required primary guardian setup, and an approved-device slot. Knowing the identifier, name, or phone alone must reveal no roster data and grant no access.

### 19.3 Catalog, release rules, files, media, and progress

Use `learning_items` as a shared schedulable/prerequisite-bearing parent for lessons, objective assessments, and subjective assignments.

| Entity                                                                        | Required fields                                                                                                                                                                                                                                                               | Required constraints/indexes                                                                                                                                                                                                                                                                                                                         |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `courses`                                                                     | organization, cohort, subject, localized slug/title/description, thumbnail, visibility, publication state, sort                                                                                                                                                               | Unique slug within organization/cohort; indexes cohort/state/visibility                                                                                                                                                                                                                                                                              |
| `course_teachers`                                                             | course, teacher, role, public sort                                                                                                                                                                                                                                            | Unique course/teacher/role                                                                                                                                                                                                                                                                                                                           |
| `curriculum_sections`                                                         | course, type `CHAPTER/UNIT`, optional parent, title, sort, state                                                                                                                                                                                                              | Chapters have no parent; units belong to a chapter in same course; maximum depth two                                                                                                                                                                                                                                                                 |
| `learning_items`                                                              | course, section, kind `LESSON/ASSESSMENT/ASSIGNMENT`, optional term, scope `TERM/COURSE_WIDE`, title, sort, publication state, `releaseAt`, optional `dueAt`, required flag, version                                                                                          | `TERM` requires a term from the same cohort; `COURSE_WIDE` has no term; specialized row exists exactly once; index course/term/state/release; published item cannot be deleted                                                                                                                                                                       |
| `learning_item_prerequisites`                                                 | target item, prerequisite item, condition, threshold                                                                                                                                                                                                                          | Same course, unique pair, no self-reference, graph acyclic                                                                                                                                                                                                                                                                                           |
| `lessons`                                                                     | shared item ID, summary/objectives, optional active media-version reference, `completionMode = VIDEO_90/PASS_LINKED_ASSESSMENT/MANUAL_ACK`, optional linked assessment ID, optional unique public preview slug/state/published time                                           | `VIDEO_90` requires a ready active media version and no linked assessment; `PASS_LINKED_ASSESSMENT` requires one same-course published MCQ assessment and no active media; `MANUAL_ACK` requires neither; public preview requires `VIDEO_90` plus public-safe metadata/resources                                                                     |
| `lesson_resources`                                                            | lesson, file, localized title, access mode, sort, state                                                                                                                                                                                                                       | Mode `VIEW_ONLY/DOWNLOAD`; only clean file; access always reauthorized                                                                                                                                                                                                                                                                               |
| `upload_intents`                                                              | organization/uploader/purpose, one-use token hash, random mutable quarantine key, declared limits, expiry/state, finalized provider version/ETag/source hash, immutable scan-key reference                                                                                    | One successful finalization; no domain attachment; later PUT to the old quarantine key is ignored; exact finalized bytes are the only scan source                                                                                                                                                                                                    |
| `files`                                                                       | organization, random final storage key/provider version, purpose, safe/original filename, claimed/detected MIME, final size/SHA-256, source upload/hash, scan state, uploader, retention due time                                                                             | Unique final key/version; only exact scanned/promoted `CLEAN` bytes attach; indexes purpose/state/retention/hash; mutable quarantine key is never served/attached                                                                                                                                                                                    |
| `file_access_events`                                                          | account/staff, file, action, authorization outcome, request/audit context, time                                                                                                                                                                                               | Append-only; sensitive proof/export access audited                                                                                                                                                                                                                                                                                                   |
| `media_assets`                                                                | storage backend `HOSTINGER_NGINX/R2_EDGE`, opaque HLS root key, master-manifest checksum, duration, dimensions, rendition metadata, processing state                                                                                                                          | `HOSTINGER_NGINX` at V1; HLS resides outside every web public root; required renditions are 720p and 480p; no source master or public MP4 exists on production; backend adapter permits later R2/edge migration without domain changes                                                                                                               |
| `lesson_media_versions`                                                       | lesson, immutable version, media asset/source checksum/duration snapshot, change class `IDENTICAL_REENCODE/REVISED_CONTENT`, state `DRAFT/READY/ACTIVE/RETIRED`, prior version, actor/reason/activation time                                                                  | One active/lesson; source/checksum/version never mutate; activation follows impact policy and does not merge revised-content ranges                                                                                                                                                                                                                  |
| `media_import_batches`, `media_import_items`                                  | source manifest/object, source checksum/size, target lesson/course, media version/provider asset, validation/encode/sample states, attempts/error, actor/times                                                                                                                | Resumable/idempotent by source checksum+target; commit only validated ready items; every item preserves migration lineage                                                                                                                                                                                                                            |
| `public_preview_sessions`                                                     | lesson and exact media version, anonymous browser-token hash, safe rate-limit metadata, start/last-renew/expiry/end, last signed-HLS authorization expiry/reference                                                                                                           | Only for explicitly published previews; bounded lifetime; NGINX validates the same short authorization contract as paid playback; no entitlement or progress credit                                                                                                                                                                                  |
| `playback_sessions`                                                           | student, lesson and exact media version, approved device, activity lease, opaque signed-HLS session/token expiry, selected rendition, start/end, last heartbeat                                                                                                               | Index active student/session; API authorizes and NGINX validates before serving private segments; cannot outlive access/lease; 720p default with 480p ABR/data-saver fallback                                                                                                                                                                        |
| `watch_events`                                                                | playback session, monotonic sequence, current/previous position, playback rate/state/event type, client/server times                                                                                                                                                          | Unique session/sequence; append-only, short retention                                                                                                                                                                                                                                                                                                |
| `watched_segments`                                                            | student, lesson media version, integer start/end seconds, source playback session                                                                                                                                                                                             | `start < end`; merge overlap/adjacency only within the exact media version                                                                                                                                                                                                                                                                           |
| `lesson_progress`                                                             | student, lesson, active media version, duration snapshot, unique watched seconds, validated wall seconds, last position, percentage, current completion time/source/version, version                                                                                          | Unique student/lesson current projection; raw version analytics and append-only award/invalidation revisions retained; at most one award per idempotent source/version                                                                                                                                                                               |
| `learning_item_progress`                                                      | student, item, current state, completed/passed/submitted/graded times, qualifying source record/version, projection version                                                                                                                                                   | Unique student/item; authoritative current prerequisite projection, rebuilt from append-only revisions/source facts                                                                                                                                                                                                                                  |
| `learning_item_progress_revisions`                                            | student, item, source type/ID/version, event `QUALIFIED/INVALIDATED/REQUALIFIED`, reason, actor/domain event, time                                                                                                                                                            | Append-only and idempotent by source event; an invalidation never deletes the earlier award; projection update and source correction commit atomically                                                                                                                                                                                               |
| `validated_learning_intervals`                                                | student, source `PLAYBACK/ASSESSMENT`, source session/attempt and sequence, server start/end, derived Cairo date/timezone-data version, state and invalidation source                                                                                                         | Unique source/sequence; only server-validated adjacent activity signals no more than 60 seconds apart while the owning learning/exam lease/window is valid; cap by real elapsed time, union overlaps, and never count preview/background/idle/seek time. Assignment contributes only its real-response submission event, not synthetic editing time. |
| `course_progress_read_models`                                                 | student, course, required/completed item counts, percent, last activity                                                                                                                                                                                                       | Rebuildable cache, never sole source of progress truth                                                                                                                                                                                                                                                                                               |
| `course_reviews`, `course_review_revisions`, `course_review_display_consents` | student, course, verified entitlement/activity evidence, rating 1–5, review text, display mode, distinct student consent plus guardian consent bound to the exact active primary-link ID/version, withdrawal times, state, submitted/moderated/withdrawn actors/times/reasons | One logical review/student/course; immutable revisions; only approved revision is public; named mode requires both live consents and the same guardian link still current-primary, otherwise immediate anonymous fallback; moderation/withdrawal audited; no phone/full identity                                                                     |

Prerequisite conditions supported at launch are prior lesson completion, prior quiz pass, prior exam released/graded above threshold, and prior assignment submitted or graded above threshold. Availability requires publication, release time, active entitlement, account/device authorization, and every prerequisite; no one condition may bypass another.

The required-item denominator uses one frozen completion rule per kind. A lesson uses its immutable completion mode below. An MCQ assessment item is complete when it has at least one valid terminal `GRADED` attempt, regardless of pass; `PASSED` is a separate stronger fact for prerequisites. Result release controls marks/answers visibility, not the student's already-known act of completion. Voiding/invalidation removes that source and recomputes completion from any other valid allowed attempt. An assignment item is complete while its current immutable response is `SUBMITTED`, `IN_REVIEW`, or `GRADED`; `RETURNED_FOR_REVISION` makes the current projection incomplete until a new valid resubmission, without erasing revision history. A graded-threshold prerequisite remains separately stronger. Disabled assignment items and practice sessions never enter the P0 denominator. Every source correction appends a progress revision and refreshes course read models; no UI infers these rules independently.

On first publication, a learning item's prerequisite edge set, conditions, thresholds, course/term/scope, and—when it is a lesson—completion mode/linked assessment become immutable. A correction creates a versioned replacement and runs the same sold-boundary impact preview, closure, cycle, authorization, and release-order checks before activation; generic prerequisite CRUD rejects mutation of a published item. A `PASS_LINKED_ASSESSMENT` link also behaves as an implicit dependency edge: the linked assessment must be authorized by every boundary that authorizes the lesson, cannot directly or transitively depend on that lesson's completion, and must be released no later than the lesson's completion can be expected. A referenced assessment version cannot be archived, unpublished, or replaced in place while the lesson remains published; staff must first publish an impact-validated replacement lesson/version and preserve historical attempt/progress sources.

### 19.4 Products, payment evidence, ledger, upgrades, and entitlements

| Entity                                                               | Required fields                                                                                                                                                                                                                                                                                                                                                   | Required constraints/indexes                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `products`                                                           | cohort, type `COURSE/TERM/FULL_YEAR`, unique public slug, optional term for `TERM`, sale window, fixed access start/end, state, current presentation version                                                                                                                                                                                                      | Product expiry within cohort; `TERM` requires one same-cohort term and other types have no product term; publish requires type-valid grants, active price and valid presentation                                                                                                       |
| `product_presentation_versions`                                      | product, version, localized title/short summary/description/benefit bullets, clean card and optional hero/OG asset, reviewed alt text, SEO metadata, state/actor/time                                                                                                                                                                                             | Immutable once published; card asset/alt required for every product type, including multi-course TERM/FULL_YEAR; never guess a bundle image from one course                                                                                                                            |
| `product_prices`                                                     | product, EGP minor amount, effective window, version/state                                                                                                                                                                                                                                                                                                        | Nonnegative; published price immutable; exactly one effective active price/time                                                                                                                                                                                                        |
| `product_content_grants`                                             | product, course, scope `FULL_COURSE/TERM`, optional term                                                                                                                                                                                                                                                                                                          | Same cohort; `FULL_COURSE` has no term; `TERM` matches product term; unique product/course/scope/term                                                                                                                                                                                  |
| `product_learning_item_grants`                                       | product, learning item                                                                                                                                                                                                                                                                                                                                            | Allowed only for a `TERM` product and a `COURSE_WIDE` item whose course already has that product's same-course `TERM` grant; unique pair; COURSE/FULL_YEAR and cross-course explicit bonuses are forbidden at launch                                                                   |
| `product_upgrade_paths`                                              | source product, target product, credit policy                                                                                                                                                                                                                                                                                                                     | Explicit same-cohort acyclic graph; never infer eligibility from titles/types                                                                                                                                                                                                          |
| `orders`                                                             | kind `PRODUCT/FUNDING_ADJUSTMENT`, buyer, beneficiary student, beneficiary membership, cohort, optional affected target order, state, subtotal, coupon discount, upgrade credit, amount due, currency, payable expiry, version                                                                                                                                    | Product formula is `amountDue = subtotal - couponDiscount - upgradeCredit >= 0`; adjustment order amount equals one open funding deficit, has no product/coupon/credit, and creates no entitlement; indexes student/state/time                                                         |
| `order_lines`                                                        | order, kind `PRODUCT/FUNDING_DEFICIT`, optional product/price/title/access/grant snapshot, optional funding case/deficit snapshot                                                                                                                                                                                                                                 | Immutable after order creation; product fields required only for `PRODUCT`, and one exact nonproduct deficit line required only for `FUNDING_ADJUSTMENT`                                                                                                                               |
| `coupons`                                                            | encrypted/normalized code lookup, type/value, active window, total/per-student limits, state                                                                                                                                                                                                                                                                      | One coupon/order; fixed or percentage constraints; feature flagged                                                                                                                                                                                                                     |
| `coupon_scopes`                                                      | coupon plus product/cohort/grade/student scope                                                                                                                                                                                                                                                                                                                    | Explicit allow rules; no implicit stack                                                                                                                                                                                                                                                |
| `coupon_reservations`, `coupon_redemptions`                          | coupon, order, student, reserved/consumed amount/time/expiry                                                                                                                                                                                                                                                                                                      | Atomic usage limits; unique coupon/order                                                                                                                                                                                                                                               |
| `upgrade_credit_reservations`                                        | target order, source line, amount, expiry                                                                                                                                                                                                                                                                                                                         | Locks available source credit against concurrent orders                                                                                                                                                                                                                                |
| `upgrade_credit_consumptions`                                        | target line, source line, amount, time, optional invalidation/restoration reference                                                                                                                                                                                                                                                                               | Append-only allocation history; never cash-withdrawable; live allocations reduce both future upgrade credit and source-refundable cash                                                                                                                                                 |
| `manual_payment_destinations`, `manual_payment_destination_versions` | stable method `INSTAPAY/WALLET`, immutable encrypted destination value, masked display/instructions, version, state `DRAFT/ACTIVE/RETIRED`, active/retired times, actor/reason                                                                                                                                                                                    | Exactly one active version/method; activation/retirement is named, owner/admin-permissioned, recent-TOTP, versioned/idempotent and audited; retired versions remain readable only through bound historical orders/submissions                                                          |
| `order_payment_destination_snapshots`                                | order, destination/version, method, encrypted/masked value and exact instructions snapshot, payable-through time                                                                                                                                                                                                                                                  | Frozen when a positive-due product/funding-adjustment order is created; one per offered method/order; new destination activation never rewrites an existing order and retirement does not invalidate it before that order's payable expiry                                             |
| `payment_submissions`                                                | order, exact order-destination snapshot/version, payer-declared EGP amount in minor units and transfer Cairo date/time, encrypted external reference and lookup HMAC, quarantine upload-intent reference, nullable clean proof file, finance-verified amount/date/destination/reference snapshot, state, submitted/review times, reviewer, reason, duplicate risk | Destination must be one frozen option on that order; `UPLOADING/SCANNING` references only intent/quarantine; clean file attaches atomically at `SUBMITTED`; one active submission/order; partial unique active/approved reference per destination; review-SLA index                    |
| `payment_review_claims`                                              | submission, finance staff, claimed/renewed/expires/released times and reason                                                                                                                                                                                                                                                                                      | One live 15-minute lease/submission; same reviewer may renew; expiry/release/reassign never resets original review-SLA clock; decision requires the caller's live claim                                                                                                                |
| `payment_duplicate_matches`                                          | candidate/matched submissions, exact/perceptual match type/score, resolution                                                                                                                                                                                                                                                                                      | Exact duplicate blocks; near match requires finance decision                                                                                                                                                                                                                           |
| `payments`                                                           | order, approved submission, method/destination snapshot, approved gross/net EGP amount, currency, state, approving/reversal actor/reason/times, version                                                                                                                                                                                                           | Exactly one approved payment/order and submission; approved cash equals the order's snapshotted `amountDue`; state `APPROVED/PARTIALLY_REFUNDED/REFUNDED/REVERSED`; financial events/ledger are append-only and amounts reconcile                                                      |
| `financial_ledger_transactions`                                      | immutable journal ID, event/source type and ID, idempotency key, EGP currency, actor/reason/time                                                                                                                                                                                                                                                                  | One journal/domain event; source/idempotency unique; never edit/delete                                                                                                                                                                                                                 |
| `financial_ledger_entries`                                           | journal, stable operational account code, debit minor, credit minor, order/payment/refund/exception/funding-case dimensions                                                                                                                                                                                                                                       | Exactly one of debit/credit is positive; every committed journal has at least two lines and total debits equal total credits in EGP                                                                                                                                                    |
| `refunds`                                                            | payment/order, amount, reason, access disposition `KEEP_ACCESS/REVOKE_ACCESS`, encrypted external reference, state, external-action start/reference, finance actors/times                                                                                                                                                                                         | Disposition is required for a partial refund and immutable once external action starts; full refund requires `REVOKE_ACCESS`; completed plus requested/processing/unknown-reserved total cannot exceed remaining refundable cash after live downstream allocations                     |
| `manual_payment_exceptions`                                          | submission/order, type `UNDERPAID/OVERPAID/WRONG_DESTINATION/UNMATCHED/OFFER_EXPIRED/BENEFICIARY_INELIGIBLE`, declared and finance-observed amount/date, state `OPEN/RETURN_PENDING/RETURNED/RESOLVED`, encrypted return/reference evidence, finance actor/times                                                                                                  | Grants no entitlement; finance-confirmed received cash posts to an unapplied-cash control/liability journal and its return clears that journal; wrong/ineligible cash is never silently combined, credited, or ignored                                                                 |
| `funding_adjustment_cases`                                           | source payment, dependent target order/credit consumption, unsupported amount, frozen pre-funding order state `PAID/PARTIALLY_REFUNDED`, target entitlement lifecycle/access disposition, state `OPEN/TOP_UP_PENDING/UNWIND_PENDING/RESOLVED`, resolution and linked `FUNDING_ADJUSTMENT` order/payment/refund records                                            | One open case/source-target pair; a forced source reversal cannot leave target access usable while underfunded; resolution is exact timely top-up or full target unwind                                                                                                                |
| `manual_entitlement_previews`                                        | student/membership, optional frozen published product/version boundary or exact custom grant proposal, access dates, closure/release/linked-assessment impact result, grant hash, actor/reason, expiry                                                                                                                                                            | Short-lived/one-use; custom exceptions require elevated entitlement permission and explicit complete prerequisites; commit rechecks every version under lock                                                                                                                           |
| `entitlements`                                                       | student, beneficiary membership, source `ORDER/ROSTER/MANUAL`, source reference, product/access snapshot, start/end, lifecycle `SCHEDULED/ACTIVE/EXPIRED/REVOKED`, access disposition `ELIGIBLE/REVOKED`, funding-hold flag/case, grant/revoke reason/actor                                                                                                       | Index student/membership/lifecycle/end; authorization requires lifecycle `ACTIVE`, disposition `ELIGIBLE`, and no funding hold; expiry remains historical and a later refund/reversal records `REVOKED` disposition without illegally rewriting `EXPIRED` back through an active state |
| `entitlement_content_grants`                                         | entitlement, course, scope `FULL_COURSE/TERM`, optional term, source grant snapshot                                                                                                                                                                                                                                                                               | Unique grant; authorization requires active parent entitlement and matching item scope                                                                                                                                                                                                 |
| `entitlement_learning_item_grants`                                   | entitlement, learning item, source grant snapshot                                                                                                                                                                                                                                                                                                                 | Unique pair; explicit exception inclusion only                                                                                                                                                                                                                                         |

Product publication enforces exact commercial semantics:

- Every type has its own immutable localized presentation version with short summary, reviewed benefit copy, clean card artwork/alt and canonical SEO/OG metadata; a TERM/FULL_YEAR bundle cannot inherit an arbitrary included-course thumbnail.
- `COURSE` has exactly one `FULL_COURSE` grant and no term, extra course grant, or explicit item grant.
- `TERM` has one product term and one or more `TERM` grants; every grant points to that same term and a same-cohort course. It may include explicitly listed course-wide orientation/bonus items only from those already term-granted courses, and every item is visible in the offer before purchase.
- `FULL_YEAR` has one or more `FULL_COURSE` grants, no product term, term-scoped grant, or explicit item grant.
- A grant set is immutable once referenced by an order **or a finalized roster-product assignment**. Finalizing a roster batch locks each assigned product/version and freezes its access dates/content boundary before any code is handed out; later product grant edits fail. A changed commercial boundary requires cloning/publishing a new product/version and never mutates the referenced one. Order lines, roster assignments, and entitlements snapshot the authorization boundary—`(course, FULL_COURSE)` or `(course, TERM, term)`—not the list of items published on purchase/roster-finalization day. A newly published item inside that immutable boundary becomes authorized by design as the year unfolds; an explicit bonus grant remains exact. A published item's course, term, and `TERM/COURSE_WIDE` scope are immutable, so moving content creates a new item/version and cannot silently rewrite old access.
- Product publication proves prerequisite closure over its complete purchasable scope: every prerequisite of every currently published/granted item is authorized by the same boundary or included as an explicit permitted course-wide item. Cross-term/cross-course hidden prerequisites fail publication; there is no undisclosed external-prerequisite escape hatch at launch.
- First publication of any learning item performs the same closure check against every published product, finalized roster-assignment snapshot, and scheduled/active historical entitlement boundary that would include the new item, including boundaries snapshotted by an expired or archived product. It locks the catalog revision, recomputes the full prerequisite closure and release ordering for each affected boundary, and blocks publication if any prerequisite would be unauthorized, unpublished after its dependent, or otherwise unreachable. An unsold/unassigned draft product may be corrected before publication; an ordered or roster-finalized boundary is immutable and cannot be repaired by silently widening its grant. Staff receive an impact report naming each failing product/roster/entitlement boundary. This gate ensures that later in-year content publication cannot turn a valid purchase or issued center code into paid-but-unreachable content.
- An item is authorized only when an active entitlement has a `FULL_COURSE` grant for its course, a `TERM` grant matching both its course and term, or an exact permitted explicit item grant. Files, media, assessments, assignments, questions, outlines, search, and prerequisite checks all use the same resolver. A term grant never leaks another term or unrelated course; a later in-boundary publication is included, while a later item move cannot occur in place.
- Progress denominators include only required published items inside the student's current entitlement scope. A broader approved upgrade adds the new scope deterministically and recalculates the read model without rewriting prior completion.
- Manual entitlement assignment normally selects a frozen published product boundary and access window, without creating cash/upgrade credit. An exceptional custom boundary requires elevated `entitlement.manual_exception`, impact preview, same student cohort/course/term cardinality, access end within cohort, and complete authorization of every published prerequisite and pass-linked assessment. Commit locks membership/catalog/preview, reruns closure and release ordering, snapshots the exact grant, and rejects stale/unreachable scope. Later item publication includes every active/scheduled manual boundary in its impact gate. Manual assignment can never be the loophole that creates paid/assigned-but-unreachable content.

There is deliberately no receipt or invoice entity, renderer, file, email attachment, or download endpoint at launch. Store and display only an authenticated in-app order/payment status timeline and payment confirmation data. It may include academy order ID, amount, method, student, payer, submitted/decision times, masked destination, and payer-supplied external reference, but it must not be labeled or styled as a receipt, tax invoice, or legally compliant fiscal document.

The append-only ledger is an operational cash-control subledger, not a claim of statutory bookkeeping or revenue recognition. Seed stable codes for at least `MANUAL_CASH_CONTROL`, `ORDER_SETTLEMENT_CONTROL`, `UNAPPLIED_CASH_LIABILITY`, `REFUND_CONTROL`, `NONCASH_DISCOUNT_CONTROL`, and `UPGRADE_ALLOCATION_CONTROL`; every nonzero approval, refund, reversal, confirmed wrong-value receipt/return, discount, and upgrade allocation/invalidation posts one balanced journal in the same transaction as its domain state. A genuinely zero-price order with no nonzero discount or credit emits a non-ledger `ZERO_VALUE_SETTLEMENT` domain/audit event because fabricating positive debit/credit lines for zero value is forbidden. Final account mapping and fiscal treatment remain subject to the professional review explicitly deferred below.

For confirmed wrong-value/unmatched cash, `UNAPPLIED_CASH_RECEIVED` debits `MANUAL_CASH_CONTROL` and credits `UNAPPLIED_CASH_LIABILITY`; `UNAPPLIED_CASH_RETURNED` posts the exact inverse and carries the encrypted external return reference. An exception cannot become `RESOLVED` until its per-case liability/control balance is zero and its observed cash is either matched through an explicitly valid path or returned. Daily reconciliation reports aggregate and per-case unapplied balances; generic notes never clear money.

> **Accepted owner risk — manual payment launch before review:** The owner explicitly elected to launch manual InstaPay/wallet collection before Egyptian legal and accounting review. The software must not claim legal, tax, invoicing, refund-policy, consumer-protection, or accounting compliance. This accepted business risk is not a technical launch blocker and does not waive payment correctness, security, record retention, or audit gates. Obtain Egyptian legal/accounting advice as soon as possible, then update retention, wording, refund handling, required transaction fields, and any receipt/invoice obligations through a signed specification change.

### 19.5 MCQ questions, official/enrichment blueprints, and attempts

| Entity                                                                 | Required fields                                                                                                                                                                                                                               | Required constraints/indexes                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `question_groups`                                                      | stable ID, course/location, state/current version                                                                                                                                                                                             | Stable shared-passage identity only; editing passage/provenance creates a group version                                                                                                                                                         |
| `question_group_versions`                                              | group, version, passage text/image, `imageIsComplex`, required reviewed short alternative when imaged, conditional long description, source/provenance, author/publish time                                                                   | Immutable once referenced; long description required iff complex; old passage/media/alternatives can never change a published assessment or attempt                                                                                             |
| `questions`                                                            | stable ID, course/location, optional group, difficulty, practice eligibility, provenance, state/current version                                                                                                                               | Objective type is exactly `MCQ_SINGLE` at launch; indexed curriculum objective/difficulty/location; group belongs to same course/location                                                                                                       |
| `question_versions`                                                    | question, version, optional exact group-version binding, prompt text/image, `imageIsComplex`, image short alternative and conditional long description, explanation, marks, author/publish time                                               | Immutable after publication/use; group version must match question's group; imaged prompt requires equivalent reviewed short alt and long description iff complex                                                                               |
| `question_options`                                                     | question version, stable key, text/image, `imageIsComplex`, image short alternative and conditional long description, sort, correct flag                                                                                                      | Two to six options; unique `(questionVersionId, stableKey)` and sort; text or image required; exactly one correct; image alternatives cannot reveal correctness                                                                                 |
| `question_imports`, `question_import_rows`                             | workbook and optional required companion image archive, validation/commit state, row payload/errors, creator/times                                                                                                                            | Validation creates no questions; commit is all-or-nothing; stable external ID prevents duplicates; image references and alternatives resolve exactly                                                                                            |
| `assessment_blueprints`                                                | course/location, assessment level, curriculum framework versions, title/state/current version                                                                                                                                                 | Versioned independently from delivery attempts                                                                                                                                                                                                  |
| `assessment_blueprint_versions`                                        | blueprint version, official/enrichment coverage summary, total questions/marks, difficulty/cognitive-skill distribution, selection policy                                                                                                     | Immutable after assessment publication; totals reconcile to rows                                                                                                                                                                                |
| `assessment_blueprint_rows`                                            | blueprint version, curriculum objective, provenance, group/passage rule, difficulty, required count/marks                                                                                                                                     | Sum counts/marks matches blueprint; enough eligible published questions before use                                                                                                                                                              |
| `assessments`                                                          | learning item, stable definition identity, state/current version                                                                                                                                                                              | Specialized row exactly once; mutable pointer only, with no grading/delivery policy outside immutable versions                                                                                                                                  |
| `assessment_versions`                                                  | assessment, level `LESSON_QUIZ/CHAPTER_EXAM/FINAL_EXAM`, delivery mode, frozen instructions, pass mark, fixed launch attempt policy, whole-attempt timer/window, exact blueprint version, randomization and result/explanation release policy | Immutable after publication; lesson quiz is unlimited and chapter/final is one attempt except one-use authorization; no per-question timer at launch; `AFTER_WINDOW_CLOSE` requires finite `windowEnd`                                          |
| `assessment_version_question_pool`                                     | assessment version, exact question version, exact optional group version, option/key/content hashes, marks, objective/difficulty/provenance, blueprint slot/group rule, selection weight/eligibility                                          | Frozen at publication from a valid question bank/blueprint; unique assessment-version/question-version; attempt selection may use only this pool and later question/group edit/archive cannot change it                                         |
| `assessment_attempts`                                                  | version, student, sequence, device/lease, state, seed, start/deadline/submit times, current result-revision reference and rebuildable current-release projection, submission reason                                                           | Unique student/assessment/sequence; exams sequence one unless audited one-time authorization; marks/pass come from current immutable result revision and visibility from its unique append-only release event, never overwritten attempt fields |
| `attempt_question_snapshots`                                           | attempt, position, frozen assessment-pool row, question/group version and option-order snapshot                                                                                                                                               | Unique attempt/position and attempt/pool row; deterministic resume/render from exact passage/prompt/options                                                                                                                                     |
| `attempt_answers`                                                      | attempt question, selected option key, revision, saved time                                                                                                                                                                                   | Unique answer/attempt question; optimistic revision and durable idempotent save                                                                                                                                                                 |
| `assessment_result_revisions`                                          | attempt, monotonic revision, kind `AUTO_GRADE/REGRADE/CORRECTION/VOID_EFFECT`, frozen assessment/question/key versions, allowlisted correction operations, earned/possible marks, pass result, superseded revision, reason, actor/time        | Append-only grade facts; one current revision/attempt; raw answers never change; regrade records old/new totals/pass and deterministic inputs                                                                                                   |
| `assessment_result_release_events`                                     | attempt, exact result revision, mode `IMMEDIATE/AFTER_WINDOW/MANUAL/CORRECTION`, optional release batch, released time, actor/reason                                                                                                          | Append-only; unique result revision; attempt/read model points to current event. A grade revision is never mutated to become released, and a released regrade gets its own event atomically.                                                    |
| `assessment_result_release_batches`, `assessment_result_release_items` | assessment/version, immutable eligible-attempt/result-revision snapshot/hash, requested release time, state/claim/attempts, per-item `PENDING/RELEASED/ALREADY_RELEASED/BLOCKED_DRIFT`, actor/times                                           | Manual-release preview/commit is versioned/idempotent; one release per result revision; item retry is safe and never releases voided/stale/ungraded results                                                                                     |
| `assessment_integrity_events`                                          | attempt, event type, client/server time, small metadata                                                                                                                                                                                       | Append-only; never directly alters grade/state                                                                                                                                                                                                  |
| `attempt_authorizations`                                               | student, assessment, one extra attempt, reason, academic actor, consumed time                                                                                                                                                                 | One-time, immutable-audited technical/accommodation escape hatch                                                                                                                                                                                |

Every published assessment version must snapshot its official MoE framework version, objective distribution, enrichment share, difficulty mix, passage/group requirements, item count, marks, timer/window, and release policy. A coverage report must distinguish `MOE_OFFICIAL` from `TEACHER_ENRICHMENT`; enrichment may supplement but never masquerade as official coverage. Editing a source mapping, question, or blueprint later never changes an existing attempt.

The dashboard/spreadsheet importer supports `.xlsx` with stable columns for external question ID, group key, passage text/image reference plus passage `is_complex`, short alternative and conditional long description; the same image fields for the question and each of two to six option text/image values; correct option key, explanation, difficulty, course/chapter/unit/lesson, official framework/objective code or enrichment objective, cognitive skill, tags, and practice eligibility. Any image reference requires a reviewed boolean complexity decision, nonempty academically equivalent short alternative, long description iff `is_complex = true`, and a companion archive entry; simple images do not duplicate short alt into a fake long description. Phase one returns row/column validation errors without domain mutation. Commit is permitted only when the complete workbook and image archive are valid and is one atomic transaction.

Import/edit creates immutable question-group and question versions with exact bindings; it never overwrites a shared passage. Assessment publication materializes the complete eligible `assessment_version_question_pool` and hashes its group passage, prompt, options/key, marks and blueprint slot. Starting any later attempt selects only those frozen pool rows, so a question/group edit, new version, archive or import after assessment publication cannot alter eligibility, rendering, randomization or grading for any student on that assessment version.

### 19.6 Subjective assignments, practice, questions, reports, support, and operations

| Entity group             | Required records and invariants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subjective assignments   | `assignments`, versioned `rubrics`/criteria, `assignment_attempts`, optimistic `assignment_drafts` with current revision and clean draft-file links, immutable typed/file response snapshots after submit, `assignment_reviews`/revisions, normalized annotations and expiring grader claims. Typed responses max 20,000 characters; up to five clean images (10 MB each) or PDFs (25 MB each); configurable assignment attempts; 48-hour grading SLA. Draft file links attach only exact CLEAN finalized uploads; submit freezes text/file IDs/hashes/rubric/attempt in one transaction.                                                                                                                                                            |
| Practice bank            | `practice_sessions`, frozen session-question order/options, answers, result/recommendation snapshots. Maximum 50 published practice-enabled MCQs/session, two-hour inactivity expiry, immediate explanation/remediation, and no effect on official grades or exam attempts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Private questions/FAQ    | `student_questions`, versioned academic answers, moderation/removal events, withdrawal/removal reason and terminal time, and a separate `published_question_entries` projection. Initial rows are private; publication requires explicit anonymization approval; published projection contains no student ID/name/phone or attachment and is course-entitlement scoped. Original state is `OPEN/ANSWERED/CLOSED/WITHDRAWN_BY_STUDENT/REMOVED_BY_STAFF`; no hard-delete endpoint exists.                                                                                                                                                                                                                                                              |
| Monthly reports          | Immutable metric `monthly_report_snapshots` unique by `(student, cairoMonth, revision)` with one current revision, metric/rule version, Cairo qualifying-day bitset/dates, month-end/longest streak, per-day validated seconds/source counts, source cutoff and snapshot-to-snapshot supersession. Separate `monthly_report_recipients`/deliveries bind snapshot, guardian, exact active link/version, verified-email version, channel and outcome; many recipients share one metric snapshot and suppression/retry never mutates it. Metrics include released/watched/completed lessons, course-progress change, validated learning time, released quiz/exam grades, assignment status, explicit-due-date misses and exact consistency calculation. |
| Product analytics        | Partitioned `product_events` with an allowlisted event code, organization, server-derived pseudonymous actor/scope, safe course/feature IDs, route family, coarse device/network class, release, and time; plus rebuildable daily aggregates. No arbitrary client event names/payloads, direct identity, free text, answers, references, or URLs.                                                                                                                                                                                                                                                                                                                                                                                                    |
| Notifications            | `notifications`, `notification_deliveries`, templates and communication preferences. Provider message IDs unique; transactional/security notices cannot be disabled; marketing requires explicit opt-in.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Announcements            | `announcements`, immutable content revisions, audience-criteria snapshots, resolved `announcement_recipients`, and channel deliveries. Audience supports explicit cohort/course/persona with server preview count; unique announcement/recipient/channel; no arbitrary SQL/filter.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Support                  | `support_tickets`, idempotent messages with `USER_VISIBLE/INTERNAL` visibility, safe attachments, exact requester/optional beneficiary scope, status/priority/category, assignee, `support_ticket_claims`, SLA/escalation/status events. Fixed-exam incidents snapshot attempt/device/network context without exposing answers in ordinary support views.                                                                                                                                                                                                                                                                                                                                                                                            |
| Exports                  | `export_jobs` with type, requester/scope/filter snapshot, state, object file, expiry and audit reference. Generated objects expire after 24 hours; access is reauthorized.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Deletion recovery safety | `deletion_operations` records stable deletion ID, account, requested/due/frozen/completed times, exact `preDeletionStatus` and restriction reason/version, mutable-by-named-admin-command `restorationStatus/reason/version`, scope hash and phase; append-only non-contact-data `deletion_tombstones`/external events carry `DELETE_DUE/DELETE_COMPLETED`, monotonic sequence, organization/account UUID, grace-expiry, scope/result hash, provider version/checkpoint and no direct identity/free text. Externally confirmed `DELETE_DUE` is mandatory before local anonymization; every restore replays due intents.                                                                                                                              |
| Feature flags            | PostgreSQL-backed `feature_flags` keyed by stable optional-module code and organization, with `ENABLED/DISABLED`, version, actor/time/reason and optional rollout evidence. Every change is named, audited/outboxed, and consumed server-side; these are not emergency controls.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Operational controls     | PostgreSQL-backed `operational_controls` keyed by organization and stable code `REGISTRATION/ORDER_CREATION/PAYMENT_REVIEW/PLAYBACK_INITIATION/EXAM_START/SUBJECTIVE_SUBMISSION/OUTBOUND_SMS/OUTBOUND_EMAIL`, state `OPEN/CLOSED`, version, actor/reason/time, optional review-at (never automatic reopen), and release/incident reference; plus `admission_controls` state `RESTRICTED/PUBLIC`. A closed control overrides feature/product state and cache.                                                                                                                                                                                                                                                                                         |
| Pilot access             | `pilot_access_entries` keyed by exactly one account or preregistered normalized phone HMAC, allowed persona/scope, state, expiry, actor/reason and optional safe last-four; plus immutable `pilot_access_imports/items` validation/commit outcomes. Server-side gates registration/claim/login/commerce while admission is `RESTRICTED`; no bearer/query bypass token or plaintext-phone export. Guardians derive ordinary access from a current allowed-student link; a matching live invitation gets only a bounded acceptance/onboarding capability until that link commits.                                                                                                                                                                      |
| Idempotency/outbox       | `idempotency_records`, `outbox_events`, `processed_effects`, `effect_attempts`, and dead-letter/replay records. Each effect has unique event/type/target, state `CLAIMED/IN_FLIGHT/CONFIRMED/UNKNOWN/FAILED/DEAD`, lease, stable provider idempotency/correlation key, provider ID, attempt/error/reconcile times.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Audit                    | `audit_events`, per-day chain heads, and exported chain roots. Application roles have no update/delete grant.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

### 19.7 Public CMS, legal content, and consent evidence

| Entity                                                          | Required fields and invariants                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `site_setting_versions`                                         | Organization, canonical/bilingual names, support hours/contacts/social URLs, theme/SEO defaults, state/version/effective time. Public reads use one published immutable version; actual secrets/payment destinations never live here.                                                                                                                                                                                                                                    |
| `teacher_profile_versions`                                      | Teacher, Arabic/English biography, qualifications/experience, approved portrait/assets with alt text, state/version. Only owner-supplied, reviewed facts publish.                                                                                                                                                                                                                                                                                                        |
| `public_pages`, `public_page_versions`, `public_content_blocks` | Stable slug/type, localized structured blocks, order, SEO metadata, publication state/window. Homepage/about/contact/marketing FAQ are data-driven; render only allowlisted block types and sanitized text/links.                                                                                                                                                                                                                                                        |
| `testimonials`, `testimonial_revisions`, `testimonial_consents` | Source person/relationship, result/quote revision, evidence, display mode, consent subject/guardian-link/version/time/source/withdrawal, moderation/publication state. For a minor/student result, subject plus current primary guardian give separate versioned consent; primary-link change invalidates named/public projection until new consent. Evidence and identity remain private; either withdrawal or due account deletion removes the projection immediately. |
| `legal_documents`, `legal_document_versions`                    | Type `TERMS/PRIVACY/REFUND/ACCESSIBILITY/ACCEPTABLE_USE/COPYRIGHT`, Arabic text plus optional English, semantic version, content hash, published/effective/retired times. A published version is immutable and a required type always has one current effective version.                                                                                                                                                                                                 |
| `policy_acceptances`                                            | Account/persona, document type/version/hash, purpose `REGISTRATION/GUARDIAN_LINK/ORDER`, beneficiary where applicable, accepted time, safe request/session metadata. Append-only; never infer acceptance of a new version from an older one.                                                                                                                                                                                                                             |

CMS content follows `DRAFT -> SCHEDULED -> PUBLISHED -> ARCHIVED`; a scheduled version may return to draft before effect, while a published version is immutable. Legal replacement is publish-new/retire-old atomically, never edit-in-place. Public cache keys include content version and purge on publication. Rich text is structured/sanitized, links use protocol/domain rules, and scripts/iframes/raw HTML are forbidden. Production publication blocks missing required real assets, consent evidence, image alternatives, legal type/version, or owner review.

## 20. State Machines and Domain Invariants

Every transition below is implemented by a named domain command. It validates actor permission and aggregate version, locks the required rows, records actor/reason/time, appends audit/outbox events where applicable, and rejects any unlisted transition with `409 INVALID_STATE_TRANSITION`.

### 20.1 Canonical state machines

**Account**

**Lean V1 authoritative flow:** public registration is closed. Staff/import creates `PENDING_SETUP`, the unique phone is explicitly `UNVERIFIED_V1`, and a separate one-use activation credential is issued. Activation proves possession of that credential—not ownership of the phone—then sets the password and first device. Student/guardian becomes `ACTIVE` after the required membership/relationship/policy transaction; staff additionally requires Cloudflare Access and TOTP. Password reset issues a server-generated temporary credential, revokes sessions and forces a new permanent password. There is no OTP, email verification, forgot-password UI, or academy message delivery in V1.

**Deferred post-V1 OTP account-flow design—do not implement or migrate these tables/routes in V1:**

- Public registration first uses `registration_sessions`; pre-OTP input creates no account and reserves no phone. Responses for new/existing/unavailable numbers are identical until CEQUENS proves control. After valid OTP, an existing owner may be told to log in/recover, while a new student account is created as `PENDING_PRIMARY_GUARDIAN` with one onboarding-only session.
- Student: `PENDING_PRIMARY_GUARDIAN -> ACTIVE` only after password, current cohort membership/online identifier, verified primary-guardian acceptance, and first approved device commit. The onboarding session can edit/resend guardian setup, policies, and account help only; it cannot browse private catalog state, order, learn, upload, or assess.
- Guardian: a new invited account enters `PENDING_SETUP -> ACTIVE` only after invited-phone OTP, name/password, required policy acceptance, and atomic child-link acceptance. It does not require a student device or TOTP. An existing active guardian remains active and gains only the verified relationship.
- Staff: invitation/bootstrap creates `PENDING_SETUP -> ACTIVE` only after verified phone, password, proven TOTP enrollment, recovery-code generation acknowledgement, and accepted role/scope transaction. Pending staff has no staff permission.
- An unconsumed registration session expires after 30 minutes. A no-history pending student/guardian/staff account expires after seven days of inactivity: cleanup revokes onboarding sessions, removes draft password/contact/token data, releases no already verified relationship, and retains only minimal nonsecret outcome/audit evidence. Resend/resume revalidates phone and never extends a pending identity indefinitely without rate controls.
- `ACTIVE <-> SUSPENDED`; support/administrator/owner must supply reason and optional suspension end.
- `ACTIVE/SUSPENDED -> BLOCKED`; `BLOCKED -> ACTIVE` by explicit authorized support/administrator/owner unblock command and reason, or `BLOCKED -> SUSPENDED` only when a separately recorded suspension is still in force. Unblock never happens implicitly on login or time passage.
- Only `PENDING_PRIMARY_GUARDIAN`, `PENDING_SETUP`, `ACTIVE`, `SUSPENDED`, or `BLOCKED` may request `DELETION_REQUESTED`, and only after the sole-primary-guardian/last-active-owner preflight in section 23.2. The transaction snapshots the exact prior status/restriction version as both `preDeletionStatus` and initial `restorationStatus`. During grace, named staff suspend/block/reactivate/unblock commands update only the restoration status while the visible account remains deletion-requested. User cancellation after password/OTP locks that same operation and restores exactly the latest permitted restoration state—never `ACTIVE` by default and never weaker than a concurrent administrative hold. At expiry the worker uses `DELETION_REQUESTED -> DELETION_FROZEN -> ANONYMIZED`; frozen has no ordinary permission/cancel, and externally confirmed `DELETE_DUE` fences terminal anonymization. Required pseudonymous history is not erased.
- Suspension, blocking, password reset, or deletion request revokes login sessions and activity leases immediately. It never silently removes a financial or assessment record.

**Student cohort membership**

- `PLANNED -> ACTIVE -> COMPLETED`; `PLANNED/ACTIVE -> WITHDRAWN` with reason. Only one membership is current-active per student.
- Annual-promotion **commit** creates the validated target `PLANNED` membership and reserved cohort-scoped identifier without changing the current source membership. Each later per-item **activation** locks the student and both memberships, completes the prior row, activates the planned row, and audits in one transaction. Neither step edits prior roster source, identifiers, orders, entitlements, progress, attempts, reports, or historical branch/cohort display.
- Academic-structure changes are versioned commands. Referenced branch/year/grade/subject/cohort/term rows may be archived but never hard-deleted; changing a date or relationship requires an impact preview and is rejected if it would invalidate a product window, order snapshot, entitlement, release, exam, report, or membership history. A cohort-promotion batch freezes candidate/source versions and validates duplicates, guardian readiness, target capacity, branch/cohort code allocation, and explicit access assignments. Commit locks each source membership and target identifier sequence, fails the commit without partial mutation on drift/conflict, creates target `PLANNED` memberships/identifiers, and carries no paid access by implication. Manual or scheduled activation claims the batch once, then processes each item in its own transaction: lock student/source/target memberships, require the frozen source version is still current-active and target still planned, complete the old and activate the target together, and mark the item `ACTIVATED`. Drift leaves that student unchanged as `BLOCKED_DRIFT` with an operator-safe reason; it never deactivates the old membership. Retry skips activated items and rechecks blocked ones. Batch is `ACTIVATED` only when all items activate, otherwise `ACTIVATED_WITH_BLOCKS`; staff resolves/repreviews blocked items explicitly. Concurrent schedulers/manual calls cannot activate twice or create two active memberships.

**Offline roster**

**Lean V1 override:** staff finalization pre-creates the account and a one-use activation credential. Phone plus roster code is not sufficient; no OTP exists. Reservation begins only after the matching phone, scoped roster identifier and activation credential all match. Finalization retains the same serializable uniqueness, guardian, membership, identifier, device and entitlement invariants below.

**Deferred post-V1 OTP claim details—do not implement in V1:**

- `DRAFT -> VALIDATED -> FINALIZED` for a roster batch. Validation writes row errors only; finalization is atomic and freezes every assigned product/version, access window, content-boundary/explicit-item snapshot, and identifier. A product grant referenced by that finalized snapshot becomes immutable just as if an order referenced it; changing the offer requires a new batch/assignment, never an edit to an issued code's future claim.
- Entry `UNCLAIMED -> CLAIM_IN_PROGRESS -> CLAIMED`; `UNCLAIMED/CLAIM_IN_PROGRESS -> VOID` only by authorized staff. `CLAIM_IN_PROGRESS -> UNCLAIMED` occurs on safe reservation expiry cleanup. Claimed/void identifiers are never reused within branch/cohort.
- Code/phone lookup and OTP challenge do not reserve the entry. Successful matching-phone OTP atomically creates or resumes the single claim session and reserves the entry for 30 minutes; each completed password/guardian step may extend it up to an absolute 24 hours from OTP. Reverified same-phone retries resume; a different concurrent request receives a generic in-progress/support response without roster disclosure.
- Finalization is one serializable transaction locking entry, claim session, phone/account, guardian, device slots, membership, identifiers, assignments, and entitlements. It rechecks verified guardian and reservation, creates or reconciles exactly one student, creates/reuses the matching cohort membership, attaches the four-digit identifier, device, guardian link, and snapshotted content grants, marks `CLAIMED`, consumes the session, and audits/outboxes. No minutes-long database lock is assumed.
- If the roster phone already belongs to an active online student, require phone OTP plus existing-account authentication and same-cohort/person checks, then attach the offline identifier/roster entitlements to that account without replacing its online ID. Ambiguous name/cohort/account conflicts go to audited staff review; never create a duplicate account automatically.
- Conflict review exposes only the proven candidate and allowlisted outcomes: `resolve-attach` reruns matching-phone OTP/existing-account authentication and all finalization invariants; `reject-release` terminates the claim session and returns an otherwise valid entry to `UNCLAIMED`; `void-entry` terminally voids a demonstrably invalid roster row. It cannot edit identity fields, select an arbitrary account, merge accounts, or bypass guardian/device/entitlement checks. `void` rejects a claimed entry and any unexpired live claim unless the same locked conflict command terminates it. `release-expired-claim` succeeds only after the reservation/absolute expiry and is idempotent.
- Expiry cleanup removes unused pending password/device material and a claim-only pending account with no other history, releases the reservation, and retains only nonsecret attempt metadata. It never deletes an existing account or an accepted guardian account.

**Course/content**

- `DRAFT -> SCHEDULED -> PUBLISHED -> ARCHIVED`.
- A scheduled item may return to draft before release. Published content cannot return to draft or be hard-deleted.
- Archiving a product/course prevents new discovery/purchase but does not revoke an active entitlement to its remaining published in-boundary items. Archiving an individual learning item prevents new starts/file/media delivery and removes it from the current required-progress denominator, while preserving immutable progress/attempt history; the command requires impact preview and fails if another active published item still depends on it. Replacements use versioning rather than destructive archive-and-overwrite.
- Publication validates curriculum mappings where required, files/media readiness, image alternatives, PDF accessibility/equivalent links, release time, prerequisite acyclicity, and child ordering.

**File**

- Upload/file: intent `OPEN -> FINALIZING -> FROZEN_FOR_SCAN -> CONSUMED/EXPIRED/REJECTED`; file `SCANNING -> CLEAN/REJECTED/INFECTED -> PURGED`.
- A domain record may attach only a `CLEAN` final file at that moment. Replacing a published file creates a new file/link version. Due purge either transactionally detaches an optional link or leaves only a non-deliverable `PURGED` metadata tombstone for immutable history; no view/download/signed URL may issue after purge.

**Product/coupon**

- `DRAFT -> ACTIVE <-> PAUSED -> EXPIRED/ARCHIVED`.
- Published price versions and redeemed coupons are immutable. Coupon expiry is derived from configured Cairo time as well as persisted state.

**Order/payment/refund/entitlement**

- Order: `PENDING_PAYMENT -> PAYMENT_REVIEW -> PAID`; an ordinary first/second rejected proof returns the order to `PENDING_PAYMENT` with its reservations and a new 24-hour window; the third rejection cancels it. Unpaid orders may otherwise become `CANCELLED/EXPIRED`; paid orders may become `PARTIALLY_REFUNDED/REFUNDED/REVERSED`. A paid upgrade affected by an already-external forced source reversal enters `FUNDING_REVIEW` atomically and returns to `PAID` only after exact top-up or ends through full unwind.
- Payment submission: `UPLOADING -> SCANNING -> SUBMITTED -> UNDER_REVIEW -> APPROVED/REJECTED`; upload/scan may enter terminal `FILE_REJECTED` without ever attaching a domain proof file. Approved submission creates one `payments` row. Payment state follows `APPROVED -> PARTIALLY_REFUNDED -> REFUNDED` or `APPROVED/PARTIALLY_REFUNDED -> REVERSED` with finance reason/reference; ledger/refund events remain append-only.
- Refund: `REQUESTED -> PROCESSING -> COMPLETED/REJECTED`; only `REQUESTED` with no external action may become `CANCELLED`. A processing timeout/ambiguous external transfer becomes `UNKNOWN_RECONCILIATION_REQUIRED`, keeps its refundable-capacity reservation, and reaches a terminal state only from positive completion/rejection/cancellation evidence. `REVERSED` means a terminal payment reversal of exactly the remaining unreimbursed cash, so completed/unknown-reserved refunds plus reversal can never exceed approved cash.
- Entitlement lifecycle is `SCHEDULED -> ACTIVE -> EXPIRED`, with scheduled/active optionally becoming `REVOKED`. `fundingHold` is an orthogonal denial overlay, not a destructive lifecycle transition: it may cover scheduled or active access, prevents authorization/activation, and preserves the frozen pre-funding state. Timely exact top-up clears the hold and reevaluates time (`SCHEDULED` before start, `ACTIVE` in-window); after `accessEnd`, top-up approval is rejected/returned and the case must unwind. Refund/reversal sets access disposition `REVOKED`; an already expired entitlement stays historically `EXPIRED` while becoming permanently ineligible for review/access.
- No payment/entitlement state is inferred from an uploaded screenshot or client redirect. Only the committed finance/provider decision changes access.

**Assessment definition and attempt**

- Assessment definition follows `DRAFT -> SCHEDULED/PUBLISHED -> ARCHIVED`; every publication creates/fixes an immutable version.
- Attempt follows `IN_PROGRESS -> SUBMITTED -> GRADED`, with `submissionReason = STUDENT/TIMEOUT/AUTHORIZED_STAFF` and optional terminal `VOIDED` correction history.
- `SUBMITTED` may be transient for auto-graded MCQ, but the transition and frozen answers must exist transactionally. Completed attempts never return to `IN_PROGRESS`.
- Voiding does not itself permit another chapter/final attempt. An academic/owner must create an audited, one-use `attempt_authorization` for a demonstrable technical incident or approved accommodation.

**Subjective assignment**

- `DRAFT -> SUBMITTED -> IN_REVIEW -> GRADED`.
- `IN_REVIEW -> RETURNED_FOR_REVISION` only if the configured attempt allowance remains; resubmission creates a new immutable response revision/attempt.
- A finalized review is not overwritten; regrading creates another review revision with reason and audit event.

**Private question and publication**

- Private question: `OPEN -> ANSWERED`; `OPEN/ANSWERED -> CLOSED`; authorized academic/owner may use `CLOSED -> OPEN` with reason when a follow-up is warranted. Reopening never changes or republishes an existing anonymized projection; new private text remains private until a new moderation revision.
- The owning student may withdraw `OPEN/ANSWERED/CLOSED -> WITHDRAWN_BY_STUDENT`; authorized academic/owner may remove those states to `REMOVED_BY_STAFF` only with an allowlisted privacy, abuse, wrong-course, or copyright reason. Both commands lock the question/version, immediately hide original text/replies/attachments from ordinary student/staff lists and signed-file delivery, and withdraw any linked public projection in the same transaction. They preserve only the bounded moderation/audit evidence described in section 23.1; `close` is not deletion, terminal withdrawal/removal cannot reopen, and there is no generic state patch or hard-delete route.
- An answered question may separately enter `APPROVED_FOR_ANONYMOUS_PUBLICATION -> PUBLISHED -> WITHDRAWN` in the gated publication projection.
- Publication never changes privacy of the original row and never copies student attachments or identifiers.

**Verified course review**

- `DRAFT -> SUBMITTED -> APPROVED/REJECTED`; `REJECTED -> DRAFT` after student edit; `APPROVED -> WITHDRAWN` by the student or authorized moderator.
- Eligibility is recalculated at submit, approve, and public projection using a qualifying entitlement plus at least one normally completed non-preview lesson. Expiry alone preserves historical eligibility; reversal/full refund/revocation or partial-refund `REVOKE_ACCESS` withdraws the projection, while partial `KEEP_ACCESS` does not. Approval snapshots the evidence and exact sanitized revision.
- Editing an approved review immediately withdraws the public revision and creates a new draft revision; nothing republishes without moderation. Anonymous display is default. Recognizable short-name display requires current student consent plus consent bound to the exact active primary-guardian link and falls back to anonymous immediately on either withdrawal or primary transfer/revocation.
- Named-display consent is a separate post-moderation command, never a review checkbox implied by submission. The student and current primary guardian each see the exact sanitized review revision, proposed public short-name string, audience/purpose, and withdrawal effect; acceptance records those hashes/versions. Staff cannot consent for either person. Revision/name change invalidates both consents. Accept/withdraw/primary-transfer races lock the review and link, and the public projection computes named eligibility on every publish/cache refresh.

**Announcement**

- `DRAFT -> SCHEDULED -> SENDING -> SENT`; `DRAFT/SCHEDULED -> CANCELLED`, and `DRAFT -> SENDING` for send-now. A scheduled announcement may return to draft before its due claim. Once `SENDING`, content/audience cannot mutate and cancel cannot recall committed recipients; delivery failures remain per-recipient retry states rather than rewriting the announcement.
- `announcement.manage` is explicit; owner/administrator may grant it to content/academic staff, while finance/support/analyst do not inherit broadcast rights. The author previews exact localized content, channel, Cairo schedule, audience criteria, estimated student/guardian counts, and exclusions before confirmation.
- On V1 send, one transaction freezes the content revision and allowlisted audience criteria and resolves unique recipients from current cohort membership, active course entitlement where selected, persona, account/link state, and organization scope. Delivery rechecks active account/guardian link and writes in-app notifications only. No email/SMS job, preference, consent path or template is enabled in V1; deferred adapters remain disabled.
- Test-send targets only the initiating authorized staff account and explicit internal test addresses, carries a visible test label, and never consumes the production audience. `SENT` means recipient fan-out committed, not that every external delivery succeeded; the staff view exposes delivered/bounced/suppressed/unknown/retrying counts without student data leakage.

**Report/export**

- `QUEUED -> RUNNING -> READY -> EXPIRED`, with retryable `FAILED` carrying a safe error code.
- Monthly report snapshot is immutable after ready. Recalculation creates a superseding version with reason rather than editing history.

### 20.2 Checkout, coupon, upgrade-credit, and entitlement rules

Final checkout is always server-calculated in this order:

1. Resolve the beneficiary student, cohort, product and immutable active price version; reject wrong-cohort or already-equivalent access unless an explicit upgrade path applies.
2. Snapshot the target subtotal and fixed access end date.
3. If the coupon feature is enabled, validate at most one code against state, Cairo active window, product/cohort/grade/student scope, total limit, per-student limit, and minimum amount. Apply percentage discount to subtotal and round down to whole minor units; cap fixed discount at subtotal. Coupons never stack.
4. Resolve prior-purchase credit only through explicit same-cohort `product_upgrade_paths`. Eligible credit is each source order line's approved net cash paid after its coupon, minus completed/processing refunds, any reversal, and credit already consumed elsewhere. Free, roster, manual, or promotional value produces no cash credit. The same live consumption also reduces cash still refundable at the source; money cannot simultaneously fund an active target and be refunded from its source.
5. Aggregate eligible source credit oldest first and cap it at subtotal after coupon. It cannot produce cash, a negative due amount, or a later-year credit.
6. Reserve coupon capacity and source credit in the same transaction as order creation. An unpaid order is payable for 24 hours. Verified completion of proof bytes pauses payable expiry while scanning/review proceeds; creating an empty upload intent does not. A non-file payment rejection starts a new 24-hour resubmission period while preserving the exact order price and reservations. Permit at most three rejected proof submissions per order; the third rejection cancels the order and requires a fresh quote.
7. Consume coupon/credit only when a finance approval or the exact zero-due settlement below activates the target entitlement. Preserve reservations through ordinary proof rejection/resubmission. Release them only on cancellation, unpaid expiry, third rejection, or a safe requote caused by invalidated source credit. Coupon expiry/deactivation does not invalidate capacity already reserved by a live order.
8. When final `amountDue > 0`, snapshot every currently active manual destination version offered for that order, including exact encrypted/masked value, instructions, and payable-through time. If none is active, do not create a payable order. Payment submission must choose one snapshot; it never rereads a newer destination.
9. Source entitlement remains active; target entitlement adds its broader snapshotted content grants and retains its own fixed cohort end date.

Destination draft/create exposes an impact preview but never changes checkout. Activation/retirement requires `payment_destination.manage` held by owner/administrator, recent non-replayed TOTP, expected version/idempotency, reason, immutable audit, and security notice to all owners; finance does not inherit this permission. Activation atomically swaps the one current version for that method. Existing orders/submissions keep their exact frozen version through payable/review completion, and retirement removes it only from new orders. Checkout-versus-activation/retirement locks the method head so an order snapshots wholly old or wholly new instructions, never a mixture; finance review displays and verifies the order-bound version.

Disabling the coupon module blocks new code validation/redemption, coupon management, and coupon reporting only. A live order's frozen reservation remains part of shared P0 commerce: zero-due settlement or payment approval may consume it, and rejection/cancellation/expiry/refund/reconciliation may release/adjust it even while the flag is off. Those workers and restore/replay logic never depend on the coupon UI flag. Re-enabling cannot duplicate a consumption or resurrect an expired reservation.

Any `PRODUCT` order whose final `amountDue` is exactly zero—whether from a zero active price, coupon, upgrade credit, or a valid mixture—settles immediately in one serializable/idempotent transaction. Lock product/price/coupon/credit/student rows; consume reservations/uses; post control journals only for strictly positive discount/upgrade amounts; set the order `PAID`; create the entitlement; audit/outbox; commit. A pure zero-price/no-discount/no-credit order emits `ZERO_VALUE_SETTLEMENT` and no ledger journal. It creates no `payments` row, payment submission, proof, external payment confirmation, or 24-hour payable window. Concurrent last-coupon/credit races yield one settlement. A positive-due order can never reach this path, and a `FUNDING_ADJUSTMENT` order can never use it.

Full target payment reversal/refund revokes target-order entitlements and restores consumed source credit only where the original source payment/entitlement remains valid. Partial refund reduces remaining refundable/creditable cash and requires an explicit stored/audited choice: `KEEP_ACCESS` leaves entitlement and downstream allocation/review eligibility unchanged; `REVOKE_ACCESS` revokes the target entitlement, withdraws its public review, invalidates/restores consumed source credit where the source remains valid, and leaves any unrefunded target cash noncreditable/non-entitling until later reconciled/refunded. Source cash covered by a live downstream consumption is not independently refundable: ordinary source refund/reversal above its unallocated refundable balance fails with `409 DEPENDENT_UPGRADE_ACTIVE`. Finance first fully unwinds the target, which atomically invalidates/restores its allocations as applicable, and only then refunds the source.

Manual or roster entitlements require a source record, fixed start/end, explicit content grants, reason, staff/batch actor, and audit event. They create no upgrade cash credit. Authorization always queries an active entitlement and the shared content-scope resolver; course visibility or a guessed product state is insufficient.

### 20.3 Manual payment review and financial consistency

- Launch methods are owner-configured InstaPay and supported wallet transfers. A submission requires the payer-declared exact EGP amount, transfer Cairo date/time, payer-supplied reference, and one clean image/PDF proof. Actual destination values remain content inputs and are returned publicly only in masked/instructional form. The checkout prominently says to transfer exactly `amountDue` once; launch does not combine multiple transfers or silently turn overpayment into account credit.
- `UPLOADING` holds a purpose-bound upload intent and quarantine key, not a domain file. After byte-size/hash/MIME verification, the order expiry pauses for scanning. When scanning succeeds, one transaction attaches the `CLEAN` file and changes the submission to `SUBMITTED`; only then does the twelve-hour finance SLA begin. Malware/type/scan rejection never attaches the file, shows a safe reason, and restores at least a 24-hour user resubmission window. A scan that cannot finish within two hours enters an operator-visible safe failure and restores the order window rather than holding it forever.
- Compute exact SHA-256 and a perceptual image hash after normalization. Reuse of an active/approved external-reference HMAC or exact proof hash returns `409 DUPLICATE_PAYMENT_EVIDENCE`; a near perceptual match is prominently flagged but requires a finance decision.
- The 12-hour review SLA begins only after upload scanning succeeds and state reaches `SUBMITTED`. Notify/remind finance at six hours and mark overdue at twelve; an overdue payment remains pending and does not auto-approve or auto-reject.
- Claiming `SUBMITTED` creates one 15-minute review lease and sets `UNDER_REVIEW`; the same finance reviewer may renew while active. Browser crash/lease expiry returns the submission to the claimable queue without changing `submittedAt` or SLA age. Finance/owner may release/reassign after recent TOTP and reason. Claim, renewal, expiry, release, and reassign are audited; concurrent claims produce one owner. Approval/rejection requires the caller's live claim and recent TOTP, then locks/revalidates it inside the decision transaction. A later payment reversal is independent of the terminal submission claim: `/staff/payments/{id}/reverse` requires its own idempotency key, recent TOTP, structured reason/evidence, and locks the payment, refunds, ledger, entitlement, and upgrade dependencies.
- Finance may claim, approve, reject, reverse, initiate/complete refund, and choose entitlement handling. These abilities are full finance permissions, not owner-only escalations.
- Approval is one serializable transaction with a mandatory `order.kind` branch after the common live-claim, clean-proof, exact-cash, destination/reference, recent-TOTP, idempotency and eligibility checks. For `PRODUCT`, lock the beneficiary/membership, product/grant snapshots and coupon/credit reservations; create the payment and balanced cash journal, consume reservations, set `PAID`, create exactly one snapshotted entitlement, and append audit/outbox. For `FUNDING_ADJUSTMENT`, lock the adjustment order/payment, case/deficit, source and target orders/payments/allocations, target entitlement and frozen pre-funding state; require the amount equals the still-open deficit and the target is still before `accessEnd`; create the adjustment payment/journal, set only the adjustment order `PAID`, resolve that deficit, and create **no** product line, coupon/credit consumption, or entitlement. Only when every deficit is funded does the same transaction restore the target's exact prior `PAID/PARTIALLY_REFUNDED` state, clear its funding hold, and reevaluate scheduled/active lifecycle. If ineligible/expired, record/return the cash and force unwind—never reactivate. OCR may assist staff but is never approval authority; a failure produces no partial access.
- Underpayment, overpayment, wrong destination, or unmatched cash cannot approve. Reject with a safe reason, open a finance-visible `manual_payment_exception`, return/reconcile the wrong-value cash with an audited external reference, and require a fresh exact transfer/order path; do not combine screenshots, fabricate a payment, leave received cash untracked, or grant partial access.
- Rejection requires a safe payer-visible reason category and may include a finance-only note. It grants no entitlement. First/second rejection preserves reservations for the same-price resubmission window; third rejection cancels the order and releases them.
- Repeating a decision with the same idempotency key returns the first result. A conflicting terminal decision returns `409 PAYMENT_ALREADY_DECIDED`.
- Refund creation locks the payment, entitlement and all active refund/source-allocation/funding rows. `completed + requested/processing/unknown-reserved refunds + requested amount` cannot exceed approved cash minus live downstream allocations. Partial creation requires an explicit immutable `KEEP_ACCESS/REVOKE_ACCESS`; full requires `REVOKE_ACCESS`. Cancel succeeds only from `REQUESTED` before any external-action timestamp/reference. Once processing starts, timeout becomes reconciliation-required and retains the reservation until positive evidence. Every terminal reversal/refund adds ledger entries and never edits approval; racing refund/reversal/cancel/late completion yields one truthful winner and cannot overpay.
- Refunding/reversing a source payment used by a pending upgrade cancels/requotes that target before changing source cash. A normal command cannot touch cash consumed by a paid target or an applied adjustment payment (`409 DEPENDENT_UPGRADE_ACTIVE` / `DEPENDENT_FUNDING_ACTIVE`). A forced external source/adjustment reversal is recorded truthfully in one linked transaction: reopen each exact deficit/case, restore the target's frozen `FUNDING_REVIEW` overlay and funding hold, preserve its prior `PAID/PARTIALLY_REFUNDED` and `SCHEDULED/ACTIVE` facts, and notify in-app. Full unwind locks all linked original/top-up cash, refunds/reconciles it without double cash-out, revokes target access disposition, invalidates/restores credit as valid, and resolves only at zero per-case imbalance. The case cannot close while ledger, allocations, orders, refunds, payments, deficits and entitlement disagree.
- Payment-proof submission, approval, rejection, reversal, and refund produce durable in-app notifications/timeline changes for the student and active linked guardian only. Do not send payment status or confirmation by SMS/email at launch, and never send/expose a generated receipt or tax invoice.

### 20.4 Video playback and completion calculation

The authoritative V1 pipeline is provider-independent private HLS. The teacher records 1080p masters; an operator workstation—not the VPS—uses FFmpeg to produce H.264/AAC renditions: 720p at about 1.0–1.1 Mbps video plus 64 kbps audio, and 480p at about 0.5–0.65 Mbps video plus 64 kbps audio, at the source frame rate of 25/30 fps with 6–10 second aligned segments. Upload a checksum manifest and HLS bundle to an opaque directory outside every public root. Production never retains the 1080p master; keep two offline physical copies.

The player requests a short opaque playback session from the API. The API checks entitlement, release, prerequisite, device and activity lease; NGINX validates the signed session on every manifest/segment request. The master manifest defaults to 720p and allows automatic 480p fallback/data-saver. Return no source MP4. Apply the moving real student name plus nonsecret ID watermark, resume, seek and up-to-2× playback. Completion still requires the server-validated union of uniquely watched ranges to reach 90%. This is deterrence and access control, not true DRM and not a promise that screen recording is impossible.

Public previews, if enabled, use a separately scoped anonymous signed-HLS session and never grant paid resources or progress. Both authorization branches use the same `MediaStorage` adapter; `HOSTINGER_NGINX` is V1 and `R2_EDGE` is the migration target.

**Deferred Bunny-specific authorization notes—do not provision or implement these provider calls in V1. The invariant logic beneath them remains useful only after replacing Bunny authorization with the signed-NGINX contract above.**

There are exactly two playback authorization branches; neither may accidentally inherit the other's privileges.

**Public full-preview branch**

1. Require a public/published product, included published course, lesson explicitly marked as a public preview, ready Bunny asset, exact allowed Origin, anonymous first-party browser token, and rate/spend checks. It deliberately requires no login, entitlement, approved device, guardian, prerequisite, or student activity lease.
2. Create an anonymous preview session with a Bunny authorization lasting no more than 90 seconds, proactively renewable only by the owning live browser session, and a maximum session lifetime of `video duration + 30 minutes`, capped at four hours. Limit one concurrent preview/browser token and ten new preview sessions/hour/browser; a replacement session cannot start until the prior session and its last media authorization expire. Use IP only as an additional abuse signal so a carrier NAT is not blocked wholesale.
3. Apply the same Basic DRM, domain restriction, direct-file block, no-MP4 policy, and no cast/download control. Overlay an academy/short random preview-session watermark, never a fabricated student name or phone.
4. Expose the complete selected preview video by design, but no paid PDF/resource, private/published learner Q&A, assessment, adjacent paid lesson, personal progress/resume credit, or student analytics identity. Record only the allowlisted anonymous preview event aggregate.

**Entitled student branch**

1. Playback authorization checks active account, student ownership, approved device, shared content-scope resolver, published/released lesson, prerequisites, and the single activity lease.
2. Acquire/renew the activity lease for the exact playback activity and approved device. Heartbeat every 30 seconds; lease expires after 120 seconds without a valid heartbeat. Track `lastMediaAuthorizationExpiresAt`; a different session/device may acquire only after both the lease and every prior authorization fence expire (or provider revocation is positively confirmed). Any different activity—another video or assessment on the same device or any activity on another device—receives `409 ACTIVITY_SESSION_ACTIVE`; it does not displace the established activity. Reopening the exact same activity from its owning session is a resume, not a competitor.
3. Issue a Bunny playback/license authorization valid no longer than 90 seconds, scoped to one media version/session and configured production domains. Renew proactively around 60 seconds only after current entitlement/device/lease-owner checks. If renewal stops, delivery must cease by the recorded authorization boundary before another session can take over. Return no MP4/source URL.
4. Overlay a moving watermark with student display name and nonsecret student ID. Movement timing is irregular enough to deter easy cropping. Do not claim that DRM or watermarking makes screen recording impossible.
5. Each heartbeat carries monotonic sequence, previous/current position, playback rate, player state, and explicit seek if applicable. Count a range only when server elapsed time and media delta are consistent with continuous playback at up to 2x plus small network tolerance. A seek resets the baseline; skipped ranges do not count.
6. Merge valid ranges across sessions. Completion occurs once when the union reaches at least 90% of the duration snapshot. Resume uses last position; completion/progress events are idempotent.

Lesson completion is an explicit immutable publication contract:

- `VIDEO_90` completes exactly once from the validated union of watched ranges for the active/qualifying immutable media version reaching 90%; neither a client event nor a staff toggle can mark it complete.
- `PASS_LINKED_ASSESSMENT` sets current completion only when the linked immutable MCQ attempt is graded at or above its frozen pass threshold and its result is released. Waiting for release prevents a newly unlocked prerequisite from leaking an unreleased pass result. A failed/unreleased attempt does not complete the lesson; a later permitted passing attempt may. Each qualifying source can award at most once, while the explicit invalidation/requalification rules below govern later result corrections.
- `MANUAL_ACK` exposes an explicit localized `Mark complete` action after the lesson is released and the student passes normal account, entitlement, membership, prerequisite, and authorization checks. The versioned/idempotent server command writes the item-progress source and completion event once. It exists only for video-less lessons with no linked assessment and cannot be invoked for another mode.

Opening or downloading a PDF/resource, reaching the route, or emitting an arbitrary analytics event never fabricates completion. A media/content replacement alone never removes earned completion. When an authoritative source result is explicitly voided, regraded below threshold, withdrawn, or otherwise corrected, that same locked domain transaction appends an `INVALIDATED` progress revision and recomputes the current projection from all remaining qualifying sources. If none remains, a pass-linked lesson completion or other source-based prerequisite becomes currently incomplete; the earlier award/correction remains historical, course/read models and review eligibility recompute, and future dependent starts are blocked. Already submitted/completed downstream attempts and immutable monthly reports are never rewritten; an activity validly started before the correction may finish, while the next start/lease acquisition uses the corrected projection. A later valid source appends `REQUALIFIED`. Manual/video completion can be reversed only through a separately permissioned exceptional correction with impact preview, reason, and audit—not by editing content. Course progress is derived from the current required published item-progress projection plus its revision history.

Published video replacement is always a new immutable `lesson_media_version`. `IDENTICAL_REENCODE` is permitted only when the original master checksum and timeline/duration match the prior version; it may carry watched ranges/resume after an impact preview. `REVISED_CONTENT` never merges ranges: already completed students retain lesson completion with the old completing-version evidence, while incomplete students start the new version at zero with an in-app explanation; old version analytics remain historical. Normal activation waits until active old-version sessions/authorization fences expire. An emergency correction may revoke renewals and wait out the fence, then activate; it cannot make a mid-session player report new-version progress. The staff impact preview shows active sessions, completed/incomplete counts, duration/checksum difference, progress consequence, public-preview effect, and prerequisite impact before confirmation.

### 20.5 MCQ assessment behavior

- Objective assessment type is single-answer MCQ only. Text, images, and passage groups are supported for prompts/options. Essay, typed answer, matching, and fill-in-the-blank do not enter the objective attempt engine; subjective work uses Assignments.
- Publishing blocks any meaningful passage/prompt/option image without academically reviewed equivalent alternatives, then freezes level/delivery mode, complete eligible question-pool rows with exact group/question/option/key versions, official MoE/enrichment blueprint metadata, marks, pass threshold, whole-attempt timer/window, fixed launch attempt policy, randomization and result/explanation release. It rejects an empty/insufficient pool or pool row not satisfying the frozen blueprint.
- Pilot lesson-quiz pass default is 60% and stored on the immutable version. Lesson quizzes allow unlimited independent attempts. Chapter/final exams allow one attempt unless an audited one-use authorization exists. Per-question timers and configurable attempt-count policies are explicitly deferred at launch; the UI never claims they are configurable.
- `SELF_PACED` may have optional overall availability; `FIXED_WINDOW` has start/end. `AFTER_WINDOW_CLOSE` is valid only with a finite frozen `windowEnd` (normally fixed-window); a windowless self-paced assessment must use immediate/manual release. Authoritative deadline is `min(startedAt + duration, windowEnd)` where applicable. Client time never extends it.
- Starting an attempt checks release/prerequisites/entitlement/device/activity lease/attempt allowance, then selects only from the immutable assessment-version pool and snapshots deterministic pool-row/question/group/choice order using a cryptographically random seed stored on the attempt. Current question-bank state is never consulted for that version.
- Answer autosave requires expected answer revision and idempotency key. Return success only after durable database commit. Reconnect returns server time, identical ordering, and every acknowledged answer; offline time continues to count.
- Student submission and timeout submission lock the attempt. The API must detect and submit an expired attempt even if the worker is delayed; the worker is a recovery mechanism, not the only timer authority. Submit/timeout races yield one terminal result.
- Auto-grade from the frozen exactly-one-correct options. Store raw selected option, earned marks, possible marks, and grading version; do not overwrite raw answers.
- Auto-grade creates immutable result revision 1 and the current projection in the same transaction. A permissioned regrade never edits answers or a prior result and accepts only `RECOMPUTE_FROZEN_KEY`, `ACCEPT_ADDITIONAL_OPTION_KEYS`, or `AWARD_QUESTION_TO_ALL` against named frozen question snapshots; it calculates rather than accepts the new marks, requires expected attempt/current-result version plus reason/recent TOTP, previews old/new totals/pass/progress dependents, and appends a new revision/audit/outbox atomically with any progress invalidation/requalification. Originally accepted options cannot be retroactively disallowed through the additive correction modes; an exact frozen-key recompute may lower a prior buggy engine total and must surface that consequence explicitly.
- Result release is `IMMEDIATE_AFTER_GRADE`, `AFTER_WINDOW_CLOSE`, or `MANUAL`. Until release, the student/guardian/export sees submitted/graded-unreleased status only; marks, correct choices, and explanations obey the same release policy. Immediate/after-window processing and the manual batch use one item command that locks the attempt/current revision, rejects void/stale/ungraded state, records release once, and emits notification/progress events after commit. Manual preview freezes exact eligible attempt/result-revision IDs and counts; commit/retry records per-item drift instead of releasing a replacement accidentally.
- If a released result is regraded, the new revision is released immediately with a visible correction label, old/new totals, safe reason, and in-app notice; it cannot become hidden. If the old result was unreleased, the new revision remains under the configured release policy. Release-versus-regrade/void locks the same attempt so the winning order yields one current revision and truthful visibility. Void preserves answers/revisions, shows a released attempt as voided without leaking previously hidden keys, and atomically invalidates dependent progress; it grants no retry by itself.
- Tab hidden, blur, fullscreen exit, reconnect, and suspicious heartbeat events display warnings and append integrity events. They never auto-fail, deduct marks, accuse cheating, or submit before the server deadline.

### 20.6 Added-target domain behavior

- **Assignments:** create returns one current draft/attempt. Draft autosave requires expected revision and idempotency, persists typed text plus exact CLEAN attachment links, rejects stale revision with the latest safe snapshot, and acknowledges only after commit; refresh/reconnect/deploy reloads the last acknowledged draft. Uploading/scanning/rejected files remain explicit and cannot submit. Submit locks attempt/draft/file versions, rechecks release/entitlement/limits/clean hashes, freezes an immutable response, clears mutable draft authority, appends progress/outbox and returns once. Concurrent save/submit yields either included acknowledged content or a stale-save rejection, never a silent loss. Returned-for-revision creates a new draft/response revision under configured attempts. Academic graders claim queue items; rubric marks reconcile; comments/annotations/regrades are versioned; SLA events at 24/40/48 hours and notification occur after commit. Abandoned unsubmitted drafts purge after 90 days inactivity or 30 days after assignment archive (earlier), with a seven-day in-app warning when the account can receive it; submitted history follows learning retention.
- **Practice:** filter by grade/course/chapter/unit/lesson/difficulty/type, with launch type MCQ only; select at most 50 published practice-enabled questions with explanations and recommended lessons; freeze order for resume; score immediately; never change official grades or attempt limits.
- **Published FAQ:** all student questions start private. Academic reply may be anonymously published only after separate moderation preview/action. The projection uses a generic student label, removes all identity/metadata and attachments, and is visible/searchable only to learners entitled to that course. Student withdrawal or staff removal of the source withdraws the projection atomically; ordinary source closing does not.
- **Coupons:** fixed/percentage, one per order, atomically scoped/limited/expired, separately enabled. Upgrade credit is not a coupon and follows the fixed calculation order above.
- **Monthly guardian reports:** generate one metric snapshot/revision for the previous Cairo month at 06:00 on its first day, independent of recipients. Snapshot released/watched/completed lessons, progress change, validated learning time, released assessment results, assignment status, explicitly due missed items, and consistency/streak. Create separate recipient/delivery rows only for current active guardian links and healthy verified email versions; two guardians receive the same snapshot ID/metrics. Send a concise email summary containing only allowlisted released metrics—never answers, private Q&A, proof data, or sensitive free text—plus a non-bearer authenticated link. A student-supplied suggestion or stale/bounced address receives nothing. SMS says only that a report is ready. Missing email/link revocation/email change suppresses or redirects only a recipient attempt after revalidation and never creates/recalculates metrics. Detailed view always rechecks current child scope; a corrected metric set creates one superseding snapshot and new eligible recipient rows.

The launch consistency rule is versioned as `CAIRO_STREAK_V1`. A Cairo civil date qualifies when the student accumulates at least 900 seconds of nonoverlapping, server-validated active learning time from entitled, non-preview video playback or authenticated assessment activity, **or** submits one non-practice objective assessment/subjective assignment containing a real response. Assignment editing time is not measured/counted. Cap credit at one real second per elapsed second across sources and exclude background/idle gaps, seeks, playback above the accepted 2x validation, public preview, arbitrary analytics, practice, invalidated/voided work, PDF/resource open, and `MANUAL_ACK` alone. Store source UTC time and derive the civil date with `Africa/Cairo` and the release's pinned timezone-data version; a 23/25-hour daylight-saving date is still one civil date and the threshold remains 900 real seconds. Current streak is consecutive qualifying dates ending today when today qualifies, otherwise ending yesterday as a grace for the unfinished current day, otherwise zero. Monthly longest streak is calculated only across dates in that Cairo month; month-end streak may include preceding dates but records its exact qualifying-date inputs. Before snapshot readiness, late/invalidated events trigger deterministic recompute; after readiness, never edit the report—create a reasoned superseding version while retaining the original. Backfill is allowed only from authoritative events still inside retention and records rule/timezone/source-cutoff versions; missing source data is shown as unavailable, never guessed.

### 20.7 Support ticket behavior

- State is `OPEN -> IN_PROGRESS -> WAITING_FOR_USER -> IN_PROGRESS -> RESOLVED -> CLOSED`. Claiming moves `OPEN` to `IN_PROGRESS`; an authorized resolver may resolve from `OPEN/IN_PROGRESS/WAITING_FOR_USER`. A requester reply to `WAITING_FOR_USER` returns it to `IN_PROGRESS` and preserves assignee. A requester may reopen `RESOLVED` within seven days, after which the worker closes it; `CLOSED` is terminal and requires a new linked ticket. No generic status patch exists.
- Create/reply/resolve/reopen/escalate require idempotency keys and expected ticket version. One 15-minute `support_ticket_claim` gives an operator the response-edit lease and may renew; assignment persists separately. Lease expiry/browser crash permits another authorized operator to claim without losing drafts/messages. Concurrent claims/replies/status commands serialize and never duplicate a user-visible message.
- A student sees only tickets they created. A guardian may create a self/account ticket or a ticket for a currently linked child; every child-ticket read/reply rechecks the active relationship, and revocation removes child-ticket access while preserving the record for staff/student. Staff lists/detail/messages are filtered by organization, permission, category/escalation, and attachment class. Ordinary support can see account/order status and fixed-exam IDs/timing/device/network context, but never proof bytes/full reference, private academic Q&A, answers, grading keys, or another guardian's private data. Internal notes never enter requester APIs/exports/notifications.
- Categories map to queues and escalation roles. Fixed/scheduled-exam tickets are `URGENT_EXAM`, enter the pinned queue, notify the staffed exam responder, and target first human response within 10 elapsed minutes during the exam support window. Account/device/payment targets are two staffed-hours and ordinary content/video/other targets four staffed-hours; clocks run only 10:00–22:00 Cairo and pause in `WAITING_FOR_USER`, except urgent-exam clocks run continuously through the scheduled on-call window. These are internal operational objectives, not a public SLA promise.
- User-visible reply/status transitions commit notification/outbox and SLA events atomically. Escalation retains the original ticket and safe context; it never grants the receiving role broader file/data access. Attachments use the support purpose/limits and exact file authorization. Staff assignment, internal note, escalation, sensitive access, and status override are audited. Auto-close and SLA reminders are duplicate-safe.
- Stale PII cannot remain forever merely because a ticket never reaches `CLOSED`. `WAITING_FOR_USER` sends an in-app reminder at 7 days of requester inactivity, auto-resolves at 30 days with a safe reason/notice, then follows the seven-day reopen window. `OPEN/IN_PROGRESS` with no user-visible activity for 30 days escalates to owner; at 60 days it auto-resolves unless an active documented security/legal hold or linked live incident exists. Urgent-exam tickets are never silently aged during the exam incident; they must be explicitly linked/resolved in post-incident review. Holds record owner/reason/review/expiry and cannot be indefinite. Any new requester reply before resolution resets inactivity. The worker uses expected version/idempotency so reminder/reply/resolve races yield one truthful state, and eventual `CLOSED` starts the retention clocks in section 23.1.

## 21. Authentication, Guardian Authorization, RBAC, and Audit

### 21.1 Lean V1 activation, phone/password, staff TOTP, and sessions

- Public self-registration is disabled. Students and guardians activate only pre-created/imported accounts using normalized phone plus a separate high-entropy, expiring, one-use credential. All V1 phone/email contacts are labeled `UNVERIFIED_V1`.
- Phone is the student/guardian login identifier. Optional email is profile data only: not login, recovery, notification, report delivery, or a claim of verification.
- Passwords are 10–128 characters, checked against a bundled common/breached list and hashed with benchmarked Argon2id. Login remains enumeration-safe and rate-limited by phone HMAC, device and IP.
- Authenticated password change requires the current password, rotates the current session and revokes all other sessions/activity leases. Staff also proves recent non-replayed TOTP.
- There is no `/register`, `/forgot-password`, OTP, SMS or application email in V1. A forgotten password routes to support. After the documented identity ceremony, support creates a reset case; the server generates a one-use temporary credential shown once, revokes sessions, sets `mustChangePassword`, and the user chooses the permanent password. Staff can never enter, retrieve or view that permanent password.
- Student/guardian sessions are seven days idle/30 days absolute; staff sessions are 30 minutes idle/eight hours absolute. Use opaque 256-bit tokens in host-only `Secure`, `HttpOnly`, `SameSite=Lax`, `__Host-` cookies, store only peppered hashes, and keep PostgreSQL authoritative.
- Staff has no self-registration. Bootstrap/invitation uses a one-use activation credential, matching Cloudflare Access identity, password, proven TOTP and acknowledged recovery codes. Cloudflare may send its own Access challenge; that is edge-provider behavior, not an academy email feature.
- Future CEQUENS/OTP support is a separate release and migration. It must verify existing phones honestly; it must never synthesize `verifiedAt` for V1 accounts.

#### Deferred post-V1 OTP/email design—do not implement in V1

- Normalize valid Egyptian mobile input to E.164 `+20...` before keyed lookup. Reject impossible/ambiguous values rather than guessing. Store encrypted phone for display, keyed HMAC for exact lookup, and optional last-four display only where needed.
- Exactly one non-anonymized account owns each phone number within the academy. `PENDING_PRIMARY_GUARDIAN`, `PENDING_SETUP`, `ACTIVE`, `SUSPENDED`, `BLOCKED`, and `DELETION_REQUESTED` all reserve it; only completed anonymization removes the encrypted value and lookup HMAC so the number can be verified for a new identity. The launch model does not multiplex student, guardian, or staff identities behind one number: the required primary guardian must supply a verified number different from the student's, and staff who also act as guardians use distinct account numbers. Explain this constraint before registration/roster finalization and route exceptions to support rather than creating ambiguous credentials. Registration, invitation acceptance, roster claim, phone change, recovery, and anonymization all enforce the same database uniqueness constraint inside their final locked transaction; application prechecks are advisory only.
- Passwords are 10-128 characters, permit passphrases, and are checked against a bundled common/breached list without fragile composition rules. Hash with Argon2id at a minimum 64 MiB memory, three iterations, parallelism one; benchmark on the real runtime and keep roughly 250-500 ms verification cost.
- CEQUENS Verification/MFA is the sole OTP generator/verifier at launch; do not also generate or hash an academy OTP. Configure a six-digit, five-minute challenge where the approved CEQUENS route supports it. The API forwards the user-entered code to CEQUENS without logging/storing it, accepts only a verified provider response for the matching challenge/purpose/phone, then atomically consumes the local challenge so a provider-success replay cannot repeat an action. Enforce maximum five local verification attempts, at least 60 seconds between sends, maximum five sends/hour and 20/day/phone, plus IP/device/global controls. Never reveal account existence.
- Password reset requires verified-phone OTP and revokes all login/activity sessions after commit; it does not free approved-device slots.
- Authenticated password change requires the current password, checks the breached-password rule, rotates the current session, revokes every other session/activity lease after commit, and sends the approved security notice. Staff also requires recent TOTP.
- Use opaque random 256-bit session tokens in `Secure`, `HttpOnly`, `SameSite=Lax`, host-only `__Host-` cookies. Never store authentication tokens in browser local/session storage. Persist only a peppered token hash.
- Student/guardian session expiry is seven days idle and 30 days absolute. Staff expiry is 30 minutes idle and eight hours absolute. Rotate tokens after login, OTP/TOTP, password/phone change, recovery, and role change.
- PostgreSQL is session authority; Valkey is a cache/revocation broadcast. Authorization still produces the correct result after cache loss.
- Staff cannot enter the staff application until password plus TOTP is complete. Accept only the configured current step with at most one adjacent step for measured clock skew, and in the same locked transaction require `candidateStep > lastAcceptedTimeStep` then advance it; concurrent use of the same code, reuse of the enrollment code, or host-clock rollback cannot authenticate twice. Recovery codes are individually hashed and consumed once under a unique/locked update. Recent password+TOTP reauthentication within ten minutes is required for role changes, phone override, device removal, payment/refund decisions, proof access, and sensitive exports.

Staff provisioning and recovery are closed workflows:

1. There is no production staff self-registration, shared administrator credential, seeded password, or permanent bootstrap endpoint. From an MFA-protected production operations shell, a one-time bootstrap command may create the first `PENDING_SETUP` owner only when the organization has no owner. It accepts the owner phone/display name through a hidden prompt or protected environment injection, emits no secret, records a `SYSTEM_BOOTSTRAP` audit event, starts normal CEQUENS phone verification, and becomes permanently ineligible once an active owner exists.
2. The owner completes phone OTP, chooses a password, scans a newly generated TOTP secret, proves one TOTP code, and saves one-time recovery codes before activation. Until all steps finish, the pending account has no staff API permission. The release record includes evidence that bootstrap is closed and no default/bootstrap secret or route remains.
3. Later staff join only through a 24-hour, one-use owner/authorized-administrator invitation to a distinct verified phone and separately frozen Cloudflare Access email or approved IdP subject, with an explicitly previewed role/scope snapshot. A reconciled outbox effect provisions the identity into the narrow pending-staff Access policy. The invitee first passes Cloudflare Access with the matching assertion, then verifies academy phone, sets password, enrolls/proves TOTP, stores recovery codes, and activates transactionally. The Access identity is an edge factor, not an academy login/notification address. Resend rotates the app token; revoke/expiry immediately denies acceptance and removes/reconciles the Access entry. Every invitation/Access step is audited.
4. A staff member who still has password and one recovery code may consume that code once, revoke all sessions, and immediately enroll/prove a new TOTP; ordinary staff support cannot perform this action for them. An authorized higher-trust actor may require another staff member to reenroll only after recent TOTP, reason, and audit; the target must still pass password plus phone OTP and creates the new secret themselves.
5. Only an owner can grant/revoke `OWNER` or `ADMINISTRATOR`, no actor may elevate themselves, and the last active owner cannot be removed, blocked, or anonymized until a replacement owner completes setup. Any sole-owner lost-phone case uses the rehearsed console ceremony because no different owner can approve it; loss of password, phone, TOTP, and recovery codes is the stronger full break-glass variant, never a UI bypass. The console path requires two named human custodians, MFA-protected technical access, every factor the target still holds, mandatory new-phone OTP, immediate credential/session rotation, external incident evidence, and immutable audit.

TOTP start creates a 15-minute pending enrollment and reveals its QR/manual secret exactly once under `Cache-Control: no-store`; the candidate secret cannot authenticate staff APIs. `prove` accepts one code for that pending secret, records/advances the candidate step once, then displays newly generated recovery codes once. `acknowledge-complete` requires the proven session and explicit recovery-code acknowledgement; one locked transaction revokes the prior factor/codes where present, activates the candidate with its accepted step, stores new code hashes, consumes the enrollment, revokes all staff sessions, and—for initial invitation/bootstrap only—activates the already frozen role/scope. The old factor remains authoritative until that commit and fails immediately afterward. Abandonment/expiry purges pending secret/code material; replay, two tabs, old/new-factor and forced-reenrollment races produce exactly one active version and no role-access gap/bypass.

Email is a verified delivery address, never a login identifier. A guardian email typed by the student is only an invitation suggestion: after phone/account/link verification, the guardian must explicitly confirm or replace it. Starting add/change requires an authenticated session and current password, sends a 30-minute one-use token to the pending address, and does not overwrite the current verified address. The link carries the token only in a client-side fragment, applies `no-referrer`, removes it immediately, and posts it in the request body; successful compare-and-swap sets encrypted email/HMAC/verified time and sends a notice to the prior verified address where available. Resend rotates the token. Staff may help start the flow but cannot mark an address verified. Report/security email is suppressed with visible contact-health state until verification; hard bounce/complaint marks it unhealthy and requires guardian reverify/change. Every report link is a non-bearer route requiring the guardian's normal authenticated child authorization at view time.

Login throttling combines phone HMAC, device, and IP: five failures in 15 minutes followed by progressive delay/lockout. Do not block a whole school/mobile-carrier NAT solely because many accounts share an IP. New-device, password/phone change, guardian-link change, and suspension produce in-app/SMS security notices as applicable; payment decisions remain in-app only.

### 21.2 Approved devices and active-learning lease

- A device identity is a random first-party HttpOnly cookie, not an invasive hardware fingerprint. Successful account activation consumes slot 1. A later correct password login from an unrecognized device may atomically consume the free slot 2 and creates an in-app security event; no OTP exists in V1.
- A third active device is blocked. Clearing app/browser data is a new device. No student or guardian device-revoke mutation exists.
- Support/administrator/owner with explicit `device.revoke` permission may revoke after recent TOTP reauthentication and required reason. Revoke all sessions/activity leases on that device and audit/notify the student.
- Student may view safe labels and last activity for own two devices. Guardian cannot view or manage student devices.
- One `student_activity_leases` row covers video learning and examination activity. A different video/assessment is blocked even in another tab on the same device, and any activity from another device is blocked while the lease heartbeat is live; the established activity is never silently kicked. After 120 seconds without heartbeat, another approved device may acquire only when any prior video-authorization fence has also expired/revoked. If a fixed or timed examination attempt is still `IN_PROGRESS`, acquisition is limited to resuming that exact attempt until it becomes terminal or its server deadline submits it; the student cannot switch to playback or a different assessment to bypass the one-activity rule. The examination's server timer continues throughout disconnection.

### 21.3 Lean V1 contact correction and password recovery

Authenticated password change requires the old password. If it is forgotten, the user contacts customer service; no self-service recovery endpoint exists. Support must use a structured case and compare multiple pre-existing academy facts. Remote WhatsApp possession, caller ID, name, phone, student code, payment amount/reference/proof screenshot, social-media messages or a logged-in device alone are insufficient. For higher-risk or ambiguous cases, require an in-person check and a second administrator/owner approval.

The server—not the employee—generates a high-entropy one-use temporary credential, displays it once, expires it quickly, revokes all current sessions/activity leases and sets `mustChangePassword`. Staff cannot set, read or communicate a permanent password. The next login can access only password setup/logout until the permanent password is changed; completion consumes the credential transactionally and records an in-app security event and immutable audit row.

Phone/email correction is staff-only in V1. Commit locks the account, rechecks phone uniqueness, writes the new encrypted value/HMAC, keeps it labeled `UNVERIFIED_V1`, revokes sessions for phone changes and audits actor/reason. It does not pretend the new number was verified. Staff TOTP loss/recovery follows the two-person owner/console break-glass ceremony; student support cannot bypass staff factors.

#### Deferred post-V1 dual-OTP phone-change/recovery design—do not implement in V1

Every phone-change session binds the account, account kind, encrypted old-number version, proposed normalized new-number HMAC, purpose, CEQUENS challenges, expiry, and one-use completion token. Starting or verifying does not release the old number or reserve the new one. Finalization locks the account, rechecks that the old version is unchanged and the new number is unused by every non-anonymized account, updates both encrypted phone and HMAC atomically, consumes both challenges/change session, revokes all authentication/activity sessions, sends safe old/new security notices where deliverable, and audits the exact recovery path. Concurrent changes to the same account or new number produce one winner and no duplicate ownership.

Normal student phone change requires a recent authenticated session, current password, old-number OTP, and new-number OTP. When the old number is unavailable:

- An authenticated primary guardian may authorize with guardian password/session and guardian-phone OTP, followed by mandatory OTP on the student's new number; or
- The academy may use the staff-assisted in-person recovery case below, followed by mandatory OTP on the student's new number.

Neither fallback can bypass verification/uniqueness of the new number. Recheck uniqueness while locking the account during final commit. Secondary guardians cannot silently replace the primary guardian or approve this fallback unless explicitly promoted through a separately verified/audited relationship change.

A guardian's normal change requires their recent session, current password, old-number OTP, and new-number OTP. A child, linked student, or another guardian can never authorize it. If the old number is lost, use only the staff-assisted in-person recovery case below plus the guardian's new-number OTP; the staff actors cannot supply or learn the code. If that guardian is a primary, finalization additionally rechecks every active child link and sends child-account security notices without exposing the new number.

The only staff-assisted student/guardian identity-recovery method enabled at launch is `IN_PERSON_ORIGINALS_TWO_STAFF`:

1. The target adult appears physically at the configured academy branch; a student target appears with the current active primary guardian. Remote WhatsApp/video/email, caller ID, possession of a logged-in/approved device, student code, payment amount/reference/proof, social-media messages, screenshots/copies, address/date-of-birth/security questions, or other knowledge-only evidence can never satisfy recovery alone or in combination.
2. An initiating authorized support/administrator/owner and a **different** approving administrator/owner each reauthenticate with recent non-replayed TOTP; at least one is an owner/administrator with `identity.recovery.approve`. Neither may be the target. The UI cannot collapse initiation and approval into one command, and approval expires after 30 minutes.
3. They visually inspect originals in person: the adult's government-issued photo ID plus an original relationship/enrollment record for a student recovery, or the guardian's government-issued photo ID plus a pre-existing academy guardian-link/signed enrollment record for guardian recovery. Names/relationship are compared with records that existed before the case; newly supplied data cannot bootstrap its own proof. This is an operational identity check, not a platform claim that the documents are legally sufficient.
4. Store only the method code, branch, actor IDs, checked document **categories**, matched pre-existing internal record IDs, timestamps, outcome, and cryptographic event hash. Do not photograph/upload the originals, retain ID/document numbers, copy free-form document text, or place sensitive notes in tickets/logs. A mismatch rejects the case and creates a security event; staff cannot edit evidence after approval.
5. The target personally enters and consumes the new-number OTP through the case-bound recovery session. Only that target session may invoke final completion after every required guardian/staff approval is already committed; staff have approve/reject authority only and cannot call a competing completion path. `PHONE_ONLY` changes only the phone. If the password is also unavailable, the case must have been separately previewed/approved as `COMBINED_PHONE_PASSWORD` and permits one immediate password setup in the same short-lived ceremony; it is never silently converted from phone-only. Completion locks/rechecks the case and all approvals, revokes every session/activity lease, optionally approves only the device physically used in the ceremony under the normal two-slot rule, consumes the case once, and notifies the old/new numbers plus the current primary guardian or all owners as applicable.
6. For 24 hours, block another phone/password recovery, data export, deletion request, guardian-primary transfer, payment-destination change, role/permission change, and device removal; ordinary learning/support on an otherwise authorized device may continue. One live case per target/new number, rate limits, repeated-case owner review, case expiry, and immutable security/audit events apply. Recovery is an in-person appointment during published staffed hours, targeted within one staffed day; if the second approver is unavailable the case remains pending with no weaker path and escalates to the owner after four staffed hours. A suspected false acceptance immediately blocks the account and starts the incident runbook.

A staff member's normal change requires a recent staff session, current password, recent non-replayed TOTP, old-number OTP, and new-number OTP. With the old phone unavailable, the target must still prove current password plus current TOTP or atomically consume an unused recovery code, verify the new number, and obtain approval from a different active owner with recent TOTP and `staff.phone.recover`; an administrator may approve only non-owner targets when explicitly granted that permission. No actor approves their own recovery. An owner change locks the organization/owner set; when another active owner exists, that different owner approves and the invariant preserves them. When the target is the sole owner, use `CONSOLE_BREAK_GLASS` for **any** lost-old-phone recovery: the two named custodians require all still-held target factors plus new-number OTP; if none remain, they execute the stronger full-recovery branch. There is no child, support, email, or UI takeover path. Every staff phone recovery revokes sessions, requires fresh login/TOTP proof, and alerts all owners/custodians.

### 21.4 Guardian record-level policy

- Student activation requires one active primary guardian relationship; contacts remain `UNVERIFIED_V1` in V1. One optional secondary guardian may be added. A guardian account can link to many children.
- Every guardian request resolves the active relationship from PostgreSQL for the requested child. Do not trust a child ID merely because it appeared in a previous token or frontend state.
- Guardian may read linked child dashboard, course progress, released grades/results, assignment/report status, entitlements, orders, payment status, and may create an order/upload proof for that beneficiary.
- Guardian cannot answer/start assessments, create private academic questions, view the child's private Q&A, control playback/activity lease/devices, impersonate the child, alter grades/progress, or access another child's data.
- Link create, verify, primary/secondary change, revoke, and transfer are audited and notify affected accounts. A sole primary guardian cannot complete own deletion until another verified primary is assigned.

Guardian-link lifecycle is explicit:

**Lean V1 override:** staff pre-creates the guardian account/link invitation and gives the guardian a separate one-use activation credential through the academy's controlled offline/support process. The guardian enters matching phone plus credential, sets a password and accepts the relationship/policies. Final acceptance locks invitation, accounts and active links and enforces one primary/two total. There is no SMS link or OTP. Primary transfer uses authenticated password/session approvals or an audited staff case with TOTP; all notices are in-app.

**Deferred post-V1 SMS/OTP invitation and transfer detail—do not implement in V1:**

1. Registration/claim creates a pending 24-hour invitation for a supplied guardian phone distinct from the student's and proposed `PRIMARY` role; it does not create a verified link. The pending student receives an onboarding-only session that can manage verification/invitation status but cannot browse paid content, order, learn, or assess. Resend rotates the opaque invitation token and respects OTP limits.
2. Deliver the acceptance URL by approved security SMS with the opaque token only in the client-side URL fragment, never the HTTP path/query. On load, the client immediately removes the fragment with `history.replaceState`, keeps it only in memory, and posts it in the acceptance request body; referrer policy is `no-referrer`. An already authenticated guardian may instead discover the invitation through the server-side phone/account match without the token appearing in HTML, logs, analytics, or storage.
3. The invited person verifies the exact invited phone through CEQUENS MFA. An existing guardian then authenticates; a new guardian supplies name and password after OTP. A phone already owned by a different account/person cannot be silently reassigned or used to reveal that account.
4. Final acceptance is one serializable transaction locking the invitation, student, guardian account, and active links. It rechecks token where used, OTP/authentication, invitation phone, one-primary/two-total constraints, and duplicate child link; then creates the relationship, consumes the invitation, audits, and notifies both accounts.
5. Student activation remains pending until primary acceptance. Expiry/abandonment reveals no guardian-account existence and lets the student rotate/resend or enter support; it never creates a half-linked active student.
6. A secondary guardian may revoke only their own link. Primary transfer uses a one-use case bound to the child, exact current-primary link version, and a separately verified active replacement-secondary link/version. Current-primary initiation requires recent session/password plus fresh phone OTP; staff fallback requires explicit permission, recent TOTP, reason, and preview. In both paths the replacement guardian separately accepts primary responsibility with their own recent password/session plus fresh phone OTP. Only a `READY` case can complete: one transaction locks the child, deletion state, both guardian accounts/links, any competing case/revoke, and named-display consents; rechecks every frozen version and active state; promotes the replacement while demoting/revoking the former primary; consumes the case; invalidates old primary-bound consents; notifies all affected accounts; and audits/outboxes. Replay, IDOR, stale/revoked link, phone change, deletion request, or concurrent transfer/revoke fails without a state containing zero or two active primaries.
7. Staff may initiate/resend/transfer/revoke with permission, recent TOTP, reason, audit, and notices, but cannot fabricate guardian OTP acceptance. Emergency account recovery changes access, not the historical relationship record.

### 21.5 Role and permission matrix

Staff can hold multiple roles; effective access is the union of explicit permissions narrowed by organization/branch/record scope. Route visibility is never the enforcement mechanism.

| Capability                                                           |                             Owner / Administrator |                                                                                Content |                        Academic |                                                        Finance |                   Support |                       Analyst |
| -------------------------------------------------------------------- | ------------------------------------------------: | -------------------------------------------------------------------------------------: | ------------------------------: | -------------------------------------------------------------: | ------------------------: | ----------------------------: |
| Organization, cohorts, flags, staff roles                            | Full according to explicit owner/admin permission |                                                                                     No |                              No |                                                             No |                        No |                Safe read only |
| Public pages, teacher profile, marketing FAQ, consented testimonials |                                              Full | Create/edit/publish when assigned; consent evidence view only with explicit permission |                            Read |                                                             No |       Public/support read |                     Aggregate |
| Legal document publication and required-policy configuration         |                   Owner/admin explicit permission |                                                                                     No |                              No |                                                             No |              Read current |                            No |
| Courses, lessons, files, Bunny links, schedule/publish/archive       |                                              Full |                                                                Full, including publish |                            Read |                                                             No |   Access-status read only |                     Aggregate |
| Curriculum frameworks/mappings and question preparation              |                                              Full |                                                        Create/edit/publish if assigned |                   Full academic |                                                             No |                        No |            Coverage aggregate |
| Assessment publication, attempt review/void/accommodation            |                                              Full |                   Create/edit/publish assigned assessment content; no attempt override |                            Full |                                                             No |      Incident/status only |             Aggregate results |
| Subjective grading and private Q&A/moderation                        |                                              Full |                                                          No unless separately academic |                            Full |                                                             No |               Status only |                     Aggregate |
| Student/guardian PII                                                 |                                      Full by need |                                                             Minimum course roster only | Minimum grading/teaching roster |                             Minimum payer/beneficiary identity |          Support identity |               None by default |
| Account status, roster claim, device removal, phone fallback         |                                              Full |                                                                                     No |                     Read status |                                                             No | Explicit recovery actions |                            No |
| Product/price/upgrade/coupon                                         |                                              Full |                                                                           Catalog read |                              No |                                       Full commerce management |               Status only |                     Aggregate |
| Proof view, approve/reject/reverse/refund                            |                                              Full |                                                                                     No |                              No |                                                           Full |     Status only, no proof | Aggregate, no proof/reference |
| Manual entitlement                                                   |                                  Full with reason |                                                                                     No |                            Read | Only through payment/refund workflow unless separately granted |                        No |                     Aggregate |
| Exports                                                              |                                              Full |                                                                            Own content |                        Academic |                                                        Finance |             Support scope | Aggregated/pseudonymized only |
| Audit                                                                |                           Full read, never mutate |                                                                      Own/domain events |               Own/domain events |                                              Own/domain events |         Own/domain events |       Approved aggregate only |

The owner cannot update/delete audit, ledger, answer, or historical version rows. Content assistants are explicitly permitted to publish. Finance assistants are explicitly permitted to approve, reject, reverse, and refund; these actions are not owner-only. Support may initiate a password-reset flow but can never read/set a password or OTP. Analyst access excludes direct identifiers, attachments, payment references/proofs, and private free text.

### 21.6 Immutable audit

Audit all staff authentication/recovery, account/guardian/device/role changes, guardian invitation/acceptance/transfer/revocation, roster claim/reservation/conflict resolution and exports, content/curriculum/question/assessment/assignment publication, public-preview configuration, announcement content/audience/test/schedule/send/cancel, support assignment/internal-note/escalation/sensitive-access/status override, payment-proof access and every financial decision, product/price/content-grant/coupon/upgrade changes, entitlement changes, exam void/extra-attempt/result-release changes, subjective grade/regrade, private-Q&A access, FAQ publication/withdrawal, course-review moderation/display-consent withdrawal, testimonial-consent access/withdrawal, CMS/legal publication, policy-acceptance configuration, sensitive exports, security-setting changes, and feature-flag changes.

Each audit row contains organization, chain/day position, actor type/ID/effective roles, action, target type/ID, redacted before/after JSON, reason, request/trace ID, safe session/device/IP metadata, timestamp, previous hash, and event hash. It must exclude passwords, OTP/TOTP, session/CSRF tokens, full payment references/proof contents, signed URLs, Bunny tokens, and unnecessary student free text.

Immutability requires all of the following:

- API/worker database roles have `INSERT/SELECT` but no `UPDATE/DELETE` permission on audit tables.
- PostgreSQL triggers reject update/delete even if application code attempts it.
- A per-day HMAC chain signs canonical event content and previous hash under a dedicated key; the chain-head row is locked during append.
- Daily chain roots are retained separately for tamper detection.
- Account anonymization preserves pseudonymous actor/target IDs but removes direct contact details.

Security/login telemetry may use its shorter retention and need not join the immutable chain unless it changes sensitive state. Business audit is not an application log and cannot be disabled to improve performance.

## 22. Idempotency, Outbox, Worker Jobs, and File Storage

### 22.1 Idempotency and transactional outbox

For each required idempotent command, insert `idempotency_records(principalId, method, routeTemplate, key, requestHash, resultStatus, resultReference, createdAt, expiresAt)` under a unique principal/method/route/key constraint. Concurrent duplicate requests wait for or return the committed first result. A key with a different canonical body is a conflict. Ordinary keys retain at least 24 hours; financial decisions, entitlement commands, and terminal assessment submissions retain a compact permanent/long-term result reference with their domain history.

Every transaction that requires asynchronous/external work inserts `outbox_events` with event UUID, aggregate type/ID/version, event type/schema version, minimal-PII payload, occurrence time, and available time. The worker:

1. Claims undispatched rows with `FOR UPDATE SKIP LOCKED`.
2. Enqueues BullMQ using `eventId` as job ID.
3. Marks dispatch only after queue acknowledgment.
4. Creates/locks the unique `processed_effects(eventId, effectType, targetKey)` row as `CLAIMED`, then records `IN_FLIGHT` and a lease before the external call. Use the same stable provider idempotency/correlation key on every attempt where supported. Internal effects commit domain result plus `CONFIRMED` atomically.
5. After a provider success, store provider ID/status and mark `CONFIRMED`. A crash/timeout after `IN_FLIGHT` but before confirmation becomes `UNKNOWN` when the lease expires—not an assumed failure. Reconcile by provider idempotency lookup, provider message/event search, delivery callback, or exact object status before deciding to confirm or retry.
6. Retry only a proven-not-accepted/transient failure with jittered backoff at approximately 1 minute, 5 minutes, 15 minutes, 1 hour, and 6 hours, then dead-letter with owner-visible operational state. If a provider offers no reliable lookup/idempotency, apply the channel policy: never blindly resend CEQUENS OTP/security SMS from `UNKNOWN`; count it against rate/spend, show “may have been sent,” wait for cooldown/user-requested rotated challenge, and invalidate the earlier token when safe. Email/report/announcement uncertainty reconciles by provider tag/message history where available; if unknowable, do not send a second sensitive message automatically. B2 writes retry only to the same content-addressed/conditional target.
7. Replays retain the original event/effect/provider key and record replay actor/reason; replay never bypasses confirmed/unknown state or creates a new logical effect.

Do not include raw payment references, proof URLs, answers, passwords/OTP, or unnecessary question/submission text in queue payloads. Workers fetch authorized/current records by IDs when processing.

Fault-inject external effects immediately before provider call, immediately after provider acceptance, before database confirmation, during callback, and during reconciliation. Evidence must prove there is neither a silently lost effect nor a blind duplicate for CEQUENS, Postmark, B2, exports, and report/announcement delivery; a durable `UNKNOWN` with an operator-safe next action is preferable to a false confirmation.

### 22.2 Required workers and schedules

- Scheduled content publication/archive and prerequisite-read-model refresh.
- Due Cairo cohort-promotion activation with one batch claim, item-level idempotent membership swap, blocked-drift reconciliation, and no implicit entitlement carry.
- Entitlement activation and fixed cohort/product expiry.
- Bunny resumable-upload/encode callback reconciliation, media-import batch retry/sample verification, lesson-media-version activation, and version-scoped playback/progress compaction.
- Assessment deadline auto-submission, immediate/after-window release, manual result-release batch claims/per-item retry, and result/progress reconciliation after regrade/void.
- Upload malware scanning, image metadata stripping, PDF validation, and abandoned-upload cleanup.
- Outbox-driven exact-version Spaces-to-B2 copier for every finalized private object, with checksum confirmation, ten-minute-lag alert, retry/dead letter, and daily bidirectional manifest reconciliation.
- Hardened scheduled backup agent for nightly encrypted logical PostgreSQL dump, audit-root copy, lifecycle/retention evidence, success/failure heartbeat, monthly restore-manifest sample, and expired-backup deletion only under the retention policy.
- Payment-review claim expiry, six-hour reminder, twelve-hour overdue state, order/coupon/upgrade reservation expiry, wrong-value cash/funding-adjustment case aging, and financial/allocation/entitlement reconciliation.
- Registration/roster-claim/pending-account/email-change/phone-change/TOTP-enrollment expiry, guardian/staff-invitation expiry, and stale approved-device/activity-lease cleanup.
- Public-preview session expiry/compaction and anonymous rate-window cleanup.
- Assignment 24/40/48-hour grading-SLA events.
- Support staffed-time/urgent-exam SLA reminders/escalations, expired response-claim cleanup, and seven-day resolved-ticket auto-close.
- Monthly report snapshot generation at 06:00 `Africa/Cairo` on day one and subsequent email/SMS delivery.
- Scheduled announcement audience resolution/fan-out plus notification send/retry/unknown-state and delivery-status reconciliation.
- PDF/XLSX roster, question, result, payment, support, and report export generation/expiry.
- Scheduled CMS/legal publication with atomic current-version replacement, cache purge, sitemap refresh, and consent/publication revalidation.
- Course-review/testimonial consent-withdrawal projection removal and stale moderation-draft cleanup without deleting immutable decision history.
- Product-event daily aggregation and 90-day raw-event partition purge.
- Thirty-day account-deletion orchestration: freeze/invariant recheck, conditional external `DELETE_DUE` append and `UNKNOWN` reconciliation, local idempotent anonymization only after confirmation, external `DELETE_COMPLETED`/checkpoint reconciliation, plus scheduled support/Q&A/announcement/file retention and backup-aware purge.
- Daily audit-chain root finalization and chain validation.
- Consistency checks for approved payment -> balanced ledger -> order -> entitlement, and frozen attempt -> answers -> mark total -> release state.

Schedules use `Africa/Cairo` explicitly and a distributed schedule lock, while database uniqueness remains the final duplicate defense. Worker outage may delay notification/report/export work but must not corrupt synchronous business state. The API itself enforces expired exam deadlines and cannot depend exclusively on a scheduled job for correctness.

### 22.3 Upload and file-delivery contract

Use S3-compatible object storage abstractions; PostgreSQL stores metadata only, and API/worker local filesystems are not durable user storage. Keep logical separation between public optimized marketing images, private course resources, private assignment/Q&A files, highly restricted payment proofs, temporary imports/exports, and quarantine.

Upload sequence:

1. API creates a ten-minute, purpose-bound, one-use upload intent after checking account, feature, count, declared MIME, and size.
2. Client uploads directly to a random quarantine object key. The key contains no student name, phone, course, or payment reference. The presigned operation permits only the declared method/key/size/content constraints and is never a read URL.
3. The idempotent completion command changes the intent to `FINALIZING`, closes it to further completion, reads provider version/ETag and bytes, verifies size/SHA-256/magic MIME, then conditionally copies that exact version/ETag to a new random scan key. Verify the scan copy's byte count/hash before `FROZEN_FOR_SCAN`. If the source changes during finalization, fail safely; any later overwrite through the still-unexpired old PUT URL affects only the abandoned quarantine key and can never change the frozen scan object.
4. Worker scans the exact frozen scan key/version with current malware signatures, rejects active/executable/macro/polyglot content, strips image metadata, and validates PDF structure. Password-protected archives/PDFs, SVG, HTML, scripts, and executables are rejected.
5. Clean/sanitized bytes are copied to a different random final private key with conditional/version checks; verify final size/hash and store its provider version before marking `CLEAN`. Only that final object may attach in a domain transaction. Quarantine/scan keys are never served and expire by cleanup. Rejected/infected content exposes a safe user-facing reason, not scanner internals.

Launch limits:

- Payment proof: one JPG/PNG/WEBP/PDF, maximum 10 MB.
- Private Q&A: one JPG/PNG/WEBP/PDF, maximum 10 MB.
- Support ticket: one JPG/PNG/WEBP/PDF, maximum 10 MB; ordinary support staff cannot use the ticket attachment path to gain access to payment proof or private academic files.
- Assignment: up to five images at 10 MB each or PDFs at 25 MB each; typed answer maximum 20,000 characters.
- Study resource: maximum 100 MB.
- Question/roster spreadsheet: `.xlsx` only, maximum 20 MB. A question workbook with any image reference must include one companion `.zip`, maximum 250 MB and 2,000 image files per import batch; image-free workbooks omit it.

Spreadsheet imports are parsed asynchronously with formulas, macros, external links, embedded objects, and network resolution disabled. Reject formula-bearing cells instead of evaluating or trusting cached results. Enforce exact sheet/header allowlists, cell-length limits, a 25,000-row roster ceiling, a 100,000-row question ceiling, expanded-archive size/compression-ratio limits, and total parser time/memory limits. Companion image paths are relative POSIX paths under `images/`; reject absolute/traversal paths, symlinks, duplicate case variants, undeclared/unused entries, SVG/HTML, and anything except scanned JPG/PNG/WEBP within the ordinary per-image limit. Invalid or oversized workbooks/archives fail with safe row/column/file errors and no partial domain mutation.

Authorize every file view/download at request time. View-only PDFs use an authenticated range-capable viewer/short-lived stream with inline disposition and no download endpoint. Explicitly downloadable resources use attachment disposition with a sanitized name. Signed file/export links expire within ten minutes and generated export objects within 24 hours. These controls deter casual sharing but cannot prevent screenshots or an authorized browser from capturing displayed bytes.

Payment-proof access requires finance/owner permission, recent staff TOTP reauthentication, and immutable audit. A payment proof is never embedded in notification email/SMS. There is no generated receipt/tax-invoice file path or export type at launch.

All CSV/XLSX exports defend against spreadsheet-formula injection: values beginning with `=`, `+`, `-`, `@`, tab, carriage return, or line feed are encoded as literal text, and untrusted hyperlinks/formulas are never emitted. Offline IDs are exported as text so leading zeroes survive. CSV is UTF-8 with an Arabic-compatible import strategy documented; XLSX uses explicit cell types. PDF exports embed an Arabic-capable font, preserve RTL/bidirectional layout, paginate repeated headers, and never clip identifiers. Every export repeats the requester’s authorized scope at generation and download time.

## 23. Privacy, Retention, Deletion, and Backend Security

### 23.1 Data minimization and retention

Use this provisional engineering retention schedule. It is a product/security default, not a representation of Egyptian legal/accounting compliance; the accepted pre-review launch risk in section 19.4 remains in force.

| Record                                                                                                              | Retention/default action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Active profile, guardian link, entitlement                                                                          | While account/relationship/access exists and through the 30-day deletion grace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Published CMS/legal versions                                                                                        | Retain immutable public history while referenced; contains no unnecessary user PII                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Policy acceptance records                                                                                           | Provisional seven-year history with document hash/version; pseudonymize subject after deletion, pending professional review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Testimonial/review consent evidence                                                                                 | While public plus 12 months after withdrawal/dispute window; then delete direct evidence and retain only nonidentifying withdrawal/audit fact unless advice requires otherwise                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Learning progress, official attempts/results, subjective submissions/reviews                                        | Until student deletion; then delete direct/private content and retain only necessary pseudonymous historical aggregates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Unsubmitted assignment drafts/files                                                                                 | Purge after 90 days inactivity or 30 days after assignment archive, whichever is earlier; warn seven days before where deliverable. Submitted immutable revisions follow learning-record retention.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Raw playback/watch and exam-integrity telemetry                                                                     | 90 days; retain derived completion/attempt facts until deletion                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Raw pseudonymous product analytics events                                                                           | 90 days; then purge raw rows and retain only nonidentifying daily aggregates needed for product/capacity trends                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Anonymous public-preview session/rate metadata                                                                      | 30 days after expiry; then purge session/browser-token hashes and retain only nonidentifying daily aggregates                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Expired registration/roster-claim/email-change/phone-change/TOTP-enrollment sessions and guardian/staff invitations | Purge token hashes, OTP references, pending phones/addresses, candidate TOTP/recovery material, and abandoned draft secrets immediately on expiry/terminal cleanup; retain minimal nonsecret outcome/audit metadata for 90 days                                                                                                                                                                                                                                                                                                                                                                                               |
| Pilot admission entries/import rows                                                                                 | While admission is restricted; purge preregistered phone HMAC/last-four, account mappings and row payloads 90 days after public admission or immediately for a deleted subject. Retain only nonidentifying counts/outcomes and actor/action audit.                                                                                                                                                                                                                                                                                                                                                                            |
| Expired/revoked sessions and device history                                                                         | 90 days after expiry/revocation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Login/security events                                                                                               | 12 months                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| CEQUENS OTP challenge/check reference                                                                               | Purge the active reference after consumption/expiry; retain only nonsecret purpose/outcome/provider-request metadata for 90 days; never retain code/hash                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Private Q&A                                                                                                         | Live original until account deletion. Student withdrawal/staff removal immediately blocks ordinary reads and file delivery, withdraws the linked public projection, and purges original question/reply text plus attachments after 30 days; retain only pseudonymous state/reason/time/content hashes for 12 months after terminal action, then purge. A documented security/legal hold has owner, reason, expiry, monthly review, and launch maximum 12 months absent later professional advice. An independently anonymized projection that was not withdrawn may remain after account deletion while educationally useful. |
| Support tickets/messages/internal notes                                                                             | Direct ticket content and event history until 24 months after `CLOSED` or account deletion, whichever is earlier; purge direct identity/free text then. Support attachments purge 12 months after `CLOSED` or at account deletion, whichever is earlier. Retain only nonidentifying category/SLA daily aggregates after purge; any bounded security/legal hold uses the same owner/reason/expiry controls.                                                                                                                                                                                                                    |
| Announcement content/audience/delivery                                                                              | Immutable announcement content and allowlisted criteria snapshot for 24 months after `SENT/CANCELLED`; direct recipient/account/link mappings and per-recipient delivery details for 12 months or until subject account deletion, whichever is earlier, then purge/pseudonymize. Nonidentifying channel/outcome/day aggregates may remain for another 24 months; audit retains only actor/action/count/hash, never the recipient list or message body.                                                                                                                                                                        |
| Payment proof image/PDF                                                                                             | Purge 12 months after terminal payment decision unless an explicitly documented legal hold is added after advice                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Order/payment/refund/manual-exception/funding-case metadata and financial ledger                                    | Provisional seven-year default, pseudonymized after account deletion, pending Egyptian legal/accounting review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Immutable business audit                                                                                            | Provisional seven-year minimum with no direct phone/email/proof content, pending review                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Import source                                                                                                       | Purge after validated/committed support window unless operationally required; keep immutable import result metadata                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Generated export object                                                                                             | 24 hours; retain job/audit metadata without exported PII                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Notification body/delivery metadata                                                                                 | 12 months, subject account deletion, or a shorter template-specific rule—whichever occurs first; retain only nonidentifying delivery aggregates afterward                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| External deletion tombstones                                                                                        | At least 18 months and always longer than the oldest restorable backup generation; no contact/free-text data; extend before extending backup retention                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Marketing consent is separate from required security, payment, and academic-operation messages. Store consent purpose, version, source, time, and withdrawal. Never reuse guardian/student contact details for marketing merely because they are operationally required.

### 23.2 Account deletion and data export

1. Recent authentication is required to request deletion. If a guardian is the sole primary for any active child, reject before changing state with a child-scoped transfer CTA; complete a verified primary transfer first. If a staff account is the last fully active owner not already deletion-requested, reject before changing state with a replacement-owner invitation/activation CTA. Every primary-link change, owner grant/revoke, owner block, and deletion request locks the same child/organization invariant so a concurrent command cannot create a last-primary or zero-owner gap.
2. Otherwise, create the deletion operation and revoke sessions/activity leases in the same lock. During the 30-day grace, V1 cancellation requires the current password from a freshly authenticated session; if unavailable, complete the manual password-reset ceremony first. Restore the latest permitted `restorationStatus`, never a weaker state than a concurrent administrative restriction. Cancellation stops once due-deletion freeze begins.
3. At grace expiry, a transaction locks the account plus current primary-child links and, for staff, organization/owner assignments; sets `DELETION_FROZEN`; revokes all ordinary staff role/scope assignments; and freezes new identity/content/payment actions by that subject. Recheck the primary/owner invariants. An unexpected blocker leaves the account frozen, pages operations, and permits only the explicit verified transfer/replacement resolution—not anonymization or a hidden bypass.
4. Create one stable random `deletionOperationId` and deterministic non-PII scope hash. Before changing any local PII, the hardened backup/deletion agent conditionally appends an immutable external `DELETE_DUE` event containing only operation ID, organization/account UUID, grace-expiry time, scope hash, sequence, and previous-event hash. It records and verifies the B2 object version/checksum/chain position. Provider timeout after a possible write enters `UNKNOWN`; the account stays frozen while reconciliation looks up that same stable event. Never blindly append a second logical intent.
5. Only after the external intent is `CONFIRMED`, one idempotent local transaction removes or irreversibly anonymizes phone/email/password, profile identifiers, device/session data, guardian links, private notifications/free text, and nonrequired files; marks the account `ANONYMIZED`; preserves required financial/audit/history rows under a random irreversible pseudonymous subject ID; and appends the local completion/result hash. Do not retain a reversible mapping merely for convenience.
6. The agent then appends `DELETE_COMPLETED` with the same operation ID/result hash and advances the external checkpoint. A crash after confirmed `DELETE_DUE` but before/during/after local anonymization is safe: reconciliation/replay reapplies the already-due operation idempotently. Unknown completion evidence is reconciled, never inferred by a duplicate local delete.
7. Delete original private Q&A and submitted attachments according to section 23.1; an already separately anonymized projection may remain only when the source was not explicitly withdrawn/removed. Immediately withdraw the student's public course-review projection when deletion becomes due, then delete review text/direct evidence under the consent schedule. A separately consented testimonial follows its own withdrawal/retention record and cannot be kept merely because it was once public.
8. Payment proof follows the locked 12-month purge unless a documented legal hold applies; retaining a proof does not justify retaining unnecessary phone/name fields with it.

Encrypted backups are not interactive archives. Deleted PII may remain only inside inaccessible encrypted backup generations until the fixed backup lifecycle expires; operators/applications cannot search or restore a person's record from them casually. Retain the minimal external tombstone journal for at least 18 months (longer than the 12-month dump chain) in a separately versioned/immutable B2 prefix. After any database/object/PITR restore, keep all user traffic and outbound workers closed, fetch/verify the latest external chain, and replay every externally confirmed `DELETE_DUE` whose grace already expired—even if the restored database has no local operation/completion row—plus every sequence newer than the restored checkpoint. Re-anonymize/delete resurrected PII/private objects idempotently, run direct-identifier scans plus sampled account/file checks, record the new checkpoint, and only then pass readiness. A restore that cannot obtain/verify the external journal fails closed.

Authenticated data export requires the current password from a freshly authenticated session in V1, creates an asynchronous job and reauthorizes at download. If the password is unavailable, complete manual reset first; there is no OTP bypass. Include only the requester's authorized records and current guardian-scoped child projections. Exclude another person's private data, internal notes, fraud heuristics, unreleased answer keys, secrets and audit internals. Use formula-safe structured JSON/CSV plus authorized files, audit create/download, notify in-app only and expire the private object after 24 hours.

### 23.3 Security controls

- Target OWASP ASVS Level 2 and explicitly test OWASP API Top 10 broken object/function authorization. UUIDs and hidden controls are never substitutes for record-level policy.
- Use exact-origin credentialed CORS, Origin validation, session-bound CSRF, secure HttpOnly cookies, HSTS after HTTPS domain readiness, MIME-sniff prevention, restrictive Referrer/Permissions policies, and a nonce-based CSP compatible only with required academy/Bunny endpoints.
- Store/render user content as plain text or tightly sanitized restricted Markdown. Never render raw student, guardian, staff, Q&A, support, assignment, or import HTML.
- Prisma parameters are mandatory. Any raw SQL is isolated, parameterized, reviewed, and tested; client filter/sort names map through allowlists.
- Do not perform server-side requests to arbitrary user URLs. Provider/file operations use stored provider IDs and strict outbound allowlists to prevent SSRF.
- Encrypt phone/email/payment destination/external reference/TOTP secrets with authenticated, versioned encryption; use separate keyed HMAC keys for exact lookup and separate keys for session pepper, audit HMAC, Bunny signing, and each provider. Never reuse one key for encryption and signing/HMAC.
- Password, OTP, TOTP, cookies, CSRF, payment references, signed URLs, proof contents, student answers, and private free text are redacted from structured logs/error monitoring. Disable body logging for auth, payment, assessment, assignment, Q&A, export, and PII routes.
- Database application roles may access only needed schemas/tables and cannot migrate schema or mutate audit history. Sensitive proof/file reads are permissioned and audited, not merely hidden in staff UI.
- Apply combined account/device/IP rate limits to authentication, OTP, registration/claim, checkout, payment proof, question/support creation, upload, and export endpoints. Playback heartbeat has a bounded session-specific limit and rejects replayed/out-of-order sequences.
- New-device, password/phone, guardian-link, suspension/block, and staff-role changes notify affected users through approved security channels. Payment/refund changes notify affected student/guardian in-app only.
- Bunny tokens are short-lived, asset/session scoped, and domain restricted. Moving watermark uses student name plus nonsecret ID. Product copy must not promise impossible absolute prevention of download/screen capture.
- Exam telemetry is proportionate and disclosed. Do not collect camera, microphone, contact list, invasive fingerprint, or unrelated browser activity.
- Validate all redirect/deep-link targets against internal allowlists. Never reflect an arbitrary post-login URL.
- Protect staff list/search/export endpoints against bulk enumeration with permission, branch scope, pagination caps, rate limits, and export audit.
- Error responses expose a safe code and trace ID only; never stack trace, query, key, filesystem/object path, provider payload, or another tenant/user's state.

## 24. Backend Acceptance and Release Gates

These checks are required automated integration/end-to-end tests unless explicitly described as a manual security review. Authentication/authorization, payment/entitlement correctness, examination durability, private-file protection, deletion correctness, and audit immutability are non-waivable P0 gates.

### 24.1 Identity, guardians, devices, and authorization

- Valid Egyptian phone variants normalize to one E.164 identity; invalid/ambiguous formats fail safely. Pre-OTP registration creates no account/reservation, returns the same response for new/existing numbers, rate-limits victim-phone attempts, purges abandoned drafts/secrets, and reveals login/recovery only after phone proof. Concurrent verified completions create at most one account/membership/identifier and route the loser safely.
- CEQUENS is the only OTP verifier: expiry, resend interval, local attempt cap, provider-success replay consumption, enumeration resistance, phone/device/IP/global limits, and uncertain provider retry behavior pass; no academy OTP value/hash exists in database/logs.
- Offline claim rejects `0000`, wrong branch/cohort, mismatched phone, wrong/expired OTP, used/void code, and code-only attempts. OTP success creates one expiring `CLAIM_IN_PROGRESS` reservation; same-phone reverify resumes; abandonment safely releases; competing starts do not race; finalization creates exactly one account/identifier/guardian/device/entitlement set. Named void/release rejects a live valid claim and serializes with expiry/finalize. Existing-online reconciliation can attach only the frozen OTP+password-proven candidate; ambiguous conflict attach/reject-release/void outcomes cannot select/merge another account. Claim/finalize/expiry/void/conflict-resolution races yield one audited terminal/resumable outcome without duplicate account, ID, or access.
- Offline ID allocation covers leading-zero IDs from `0001`, never reuses, is unique only within branch/cohort as intended, and reports capacity at 9,999. Online IDs begin at 10001 and survive concurrent allocation without duplicate/gap reuse.
- Academic-structure CRUD is permissioned/versioned and archive-only once referenced. Date/relationship impact preview blocks changes that invalidate products, entitlements, releases, exams, or history. Cohort-promotion preview/commit rejects stale candidates, capacity/identifier/guardian conflicts, duplicate commits, and unintended entitlement carry. Manual and Cairo-scheduled activation, cancellation-before-start, scheduler crash/retry, concurrent manual/scheduler calls, concurrent membership drift, mixed blocked outcomes, and blocked-item replay preserve exactly one current-active membership, never deactivate a drifted student's source, never activate/carry access twice, and retain historical roster/order/entitlement/progress/attempt/report display.
- Student cannot activate without one primary guardian. Invitation expiry/resend, new/existing guardian acceptance, phone mismatch, token replay, and two concurrent acceptances preserve one-primary/two-total invariants. Current-primary transfer start/OTP/complete and staff-fallback cases require exact link versions plus the replacement guardian's separate password/OTP acceptance; IDOR, replay, stale case, phone/link/deletion drift, concurrent transfer/revoke/delete, and consent invalidation tests never produce zero/two primaries. Secondary self-revoke remains self-only. Staff cannot mark an unverified guardian accepted; a guardian can access every linked child and no unlinked child.
- A student-supplied guardian email remains a nondeliverable suggestion. Confirm/add/change/resend requires the guardian flow; wrong/expired/replayed email token, concurrent changes, prior-address overwrite race, hard bounce/complaint, and existing-guardian invitation cannot send a report to an unverified/stale address. Report links require normal guardian login/current child link and carry no bearer access.
- Replace child/student/account/file/order UUIDs in every guardian/student route and export; all cross-record IDOR attempts fail without revealing existence.
- Two simultaneous approved-device activations create no more than two slots. Third device is blocked. Student/guardian revoke endpoints do not exist. Authorized staff revoke terminates affected sessions/lease and creates audit/notice.
- A different learning/exam activity is blocked in another tab on the same device and on another device while the first lease is live; the established session continues. After lease timeout another approved device may resume the exact in-progress exam but cannot start playback/another assessment until that attempt is terminal; its timer remains server-authoritative.
- First-owner bootstrap works only once with no default credential or public bootstrap route; an incomplete owner has zero staff permission. Staff invitation tests bind a distinct Cloudflare Access email/IdP subject, provision/reconcile it, reject wrong/missing/expired JWT audience or identity, then require phone/password/TOTP/recovery-code completion. Expiry/revoke/suspend/block/deletion immediately denies the app and reconciles Access removal. No generic account patch bypasses either layer; last-owner, replay, time-skew, role and reauthentication tests pass.
- The database rejects one normalized phone across every student/guardian/staff kind and every non-anonymized pending/active/suspended/blocked/deletion state. Concurrent registration, invitation acceptance, roster claim, phone changes, recovery, and anonymization cannot steal or duplicate a reserved number. Student normal/primary-guardian/in-person, guardian normal/in-person, staff normal/different-owner, and sole-owner break-glass paths each require their exact factors; none skips new-number OTP, permits child/peer/self takeover, loses the last owner, or leaves old sessions active. Social-engineering tests prove payment proof/reference, student code, known personal facts, device/cookie, caller ID, WhatsApp/email/video, screenshot/copied ID, one staff actor, a newly created supporting record, stale approval, or a reason textbox cannot satisfy in-person recovery; evidence minimization, 24-hour cooldown, notices, false-accept blocking, and concurrent case completion pass.
- Test every role/permission combination, multi-role union, organization/branch scope, direct-route attempt, and revoked-role session. Content can publish courses/lessons/assigned MCQ assessments/public CMS but cannot change price/product/legal/payment; academic can grade/moderate; finance can manage product commerce and fully decide/refund but not academic content; support cannot see proof/private Q&A or edit grades; analyst receives no direct PII.
- Account suspend/block/deletion request immediately denies learning, exam, payment mutation, file, and activity access while preserving correct historical views/records. Sole-primary and last-owner deletion requests fail before state change; concurrent primary/owner transfer, revoke, block, and delete commands preserve both invariants.

### 24.2 Curriculum, content, files, and video

- A course/learning item/question can map independently to versioned official MoE objectives and teacher enrichment; APIs/reports never merge or mislabel provenance.
- Official framework update creates a new version and leaves prior course coverage/assessment attempts unchanged.
- Assessment-blueprint validation checks framework/objective provenance, official/enrichment totals, question/mark totals, difficulty/cognitive-skill distribution, passage rules, and sufficient eligible MCQs.
- Course/content publish rejects invalid files/media, cross-course prerequisites, explicit or pass-linked cycles, impossible schedule, or stale version. Published prerequisite edges/thresholds/completion mode/linked assessment cannot mutate in place. Later item publication recomputes closure/release ordering across every product, finalized-roster, and live historical entitlement boundary and blocks any paid-but-unreachable scope. Linked-assessment archive/replacement is blocked while referenced unless a versioned impact-safe replacement passes the same gate. Cairo release works correctly across daylight-saving changes.
- Product storefront/detail is product-slug based and renders COURSE/TERM/FULL_YEAR without course/product conflation. Each product uses its own published card/hero/OG presentation and reviewed alt; a bundle never borrows an arbitrary course thumbnail. Draft products/courses and stale product/CMS/legal versions never leak through metadata, sitemap, preview payload, or cache.
- CMS tests prove versioned page/teacher/FAQ/legal publication, sanitization, required real content/assets, testimonial consent/withdrawal, exact policy acceptance versions, public cache purge, and no hardcoded/fabricated production claim.
- Entitled/released/prerequisite-complete students get content; non-entitled, wrong-cohort, suspended, guardian, or other-student requests cannot retrieve metadata, files, or signed media. TERM grants expose only matching-term plus explicit item grants, FULL_COURSE exposes all, and entitlement-aware progress expands deterministically on approved upgrade.
- Upload tests reject oversize, renamed executable, SVG/HTML, polyglot, macro, infected, malformed/password-protected PDF, wrong magic MIME, path traversal, and abandoned intent. Concurrent/repeated complete, overwrite-before/after-complete, overwrite-during-scan, source-version/ETag mismatch, copy/hash failure, and scan/finalize races can never attach bytes other than the exact scanned final version. No domain record attaches before clean scan; retention purge of a referenced file leaves only a nondeliverable tombstone/detached link and every later URL request fails.
- View-only resource has no download endpoint/attachment response; explicit downloadable resource does. All signed links expire and remain account/resource scoped.
- Bunny response contains no source MP4. Expired/wrong-domain/wrong-asset token fails. Entitled watermark has correct student name/ID. A published public preview works without login/device/entitlement only through its bounded anonymous session, uses academy/session watermark, provides the full selected video but no paid resource/Q&A/progress/adjacent content, and an unflagged/draft preview fails. No backend/product assertion promises absolute screen-record prevention.
- Playback tests cover normal, 2x, pause, seek, skipped 90%, replayed/out-of-order heartbeat, implausible jump, reconnect, overlapping segments, second device, and resume. Crash just after authorization proves no second session/device can acquire while the old CDN/license fence remains; stopped renewal ceases delivery before takeover. Preview replacement/concurrency obeys the same fence. Only the union of valid ranges for one exact media version at 90% completes exactly once.
- Media tests cover resumable create/upload/retry/reconcile/import checksum lineage, callback duplication, encode failure, sampled playback, and publication readiness. Identical re-encode may carry ranges only with matching master/timeline; revised replacement preserves completed evidence, resets incomplete projection, never merges versions, waits/revokes old sessions safely, and handles activation during a heartbeat race without false completion.
- Completion-mode tests prove `VIDEO_90` cannot use manual/pass completion, `MANUAL_ACK` is authorized/versioned/idempotent and a PDF open does nothing, and `PASS_LINKED_ASSESSMENT` waits for a released qualifying grade, rejects fail/unreleased/cross-boundary/cycle/archive cases, and can qualify on a later permitted pass. A void/regrade below threshold appends invalidation, uses another qualifying source if present, otherwise relocks future dependents/read models without rewriting completed downstream attempts/reports; correction-versus-start and invalidation-versus-requalification races serialize.
- Course-progress tests freeze kind semantics: MCQ completion requires one valid graded attempt but not pass/release; pass remains a distinct prerequisite fact; void falls back to another valid attempt or retracts current completion. Assignment completion covers submitted/in-review/graded, retracts on return-for-revision until resubmission, and threshold prerequisites remain distinct. Feature-off assignments/practice are excluded. Percent/count/read models match source revisions after every race.
- Every meaningful public/course/MCQ image blocks publication without safe equivalent short/long alternatives. Every enabled P0 PDF is tagged/readable or has a complete adjacent accessible HTML/text equivalent; manual screen-reader review verifies reading order and task equivalence.
- Private Q&A P0 routes work with the publication flag off, isolate each student/attachment, permit academic reply/close/audited reopen, and never expose private text to guardians/support/unrelated learners. Student withdraw and permissioned staff remove are race-safe terminal commands, immediately block original/file delivery and linked FAQ projection, enforce reason policy, and meet 30-day content/12-month evidence retention; close is not deletion. Course-review tests enforce qualifying/historically expired versus reversed/full/partial-refund behavior, one completed non-preview lesson, one logical review, state/revision/moderation/withdrawal, anonymous default, separate student/current-primary consent bound to the exact approved revision/display string/link version, immediate withdrawal/primary-transfer anonymous fallback, and consent/edit/transfer/deletion races. Minor testimonial tests require both current subject/primary consents and immediately remove projection on either withdrawal/link change/deletion.

### 24.3 Orders, payments, refunds, and entitlements

- Minor-unit arithmetic exactly reconciles displayed and stored subtotal, one coupon, prior net-paid credit, and amount due. Percentage rounding and fixed caps are deterministic.
- Zero-due product orders from zero price, coupon-only, credit-only, and mixed funding settle once without proof/payment row and create exactly one entitlement. Pure zero price creates `ZERO_VALUE_SETTLEMENT` with no journal; only strictly positive discount/credit values create balanced control journals. Positive-due and funding-adjustment orders cannot enter that path.
- Coupon feature-off behavior exposes no route/discount; when enabled, scope, Cairo dates, total/per-student limits, one-code rule, and concurrent last-use race pass.
- Upgrade tests cover course-to-term, course/term-to-year, multiple sources, coupon-before-credit, source partial refund, prior consumed credit, zero-due upgrade, failed/rejected order, concurrent upgrades, full target refund, and cohort mismatch.
- Product publication rejects invalid grant cardinality: COURSE is exactly one full course with no item grant, TERM uses only its one term plus exact same-granted-course course-wide items, and FULL_YEAR uses full-course grants with no item grant. Prerequisite closure blocks hidden cross-scope dependencies. Finalizing a roster assignment freezes product/version/access dates/content boundary; any product-grant edit after order/roster reference fails and a changed offer must be a cloned new product, while delayed claimants receive the original snapshot. A newly published in-boundary lesson is admitted only after every original/new product, roster, manual and entitlement boundary closure gate passes; moving a published item in place fails and archive impact/prerequisite/progress behavior is deterministic.
- Manual-entitlement preview/commit prefers a frozen product boundary and rejects stale preview, wrong cohort/term/cardinality/date, hidden prerequisite, linked-assessment leak, duplicate access, or unauthorized custom exception. Commit-versus-later-item publication serializes; neither can create an unreachable manual scope, and manual grants create no cash/upgrade credit.
- Exact external-reference/proof duplicate is blocked; near-image match is flagged for finance and never auto-approved. `UPLOADING/SCANNING` references quarantine intent only; verified byte completion pauses expiry; only CLEAN attaches atomically at SUBMITTED. Infected/invalid/timed-out scan cannot enter review and safely restores a user window. Approval rejects when payer-declared or finance-observed transfer amount differs from immutable `amountDue`, when destination/reference/date cannot be verified, or when more than one transfer would need combining; wrong-value cash enters a non-entitling return/reconciliation case.
- An uploaded proof, twelve-hour timeout, or client claim never grants access. Only committed approval creates entitlement.
- Concurrent finance claims produce one 15-minute owner; renew/release/reassign/expiry preserve SLA age, a crashed reviewer cannot strand the queue, and only the live claimed reviewer with recent TOTP can approve/reject. Claim-expiry-versus-approval serializes safely. A reversal weeks later uses the payment command with fresh TOTP/idempotency and full refund/allocation/entitlement locks, not a dead submission claim.
- Fault-inject before/during/after each approval transaction operation. Recovery always yields either no decision/access or exactly one approved decision, balanced ledger, consumed reservation, order paid, audit/outbox, and entitlement.
- Approval rechecks active/eligible beneficiary account and cohort membership, buyer/guardian authority, product/grant snapshot, and future access end. Suspension/deletion/membership change/expired access while proof waits cannot grant stale or already-expired access; received cash enters a tracked return/requote path.
- Payment-destination draft/impact/activate/retire rejects finance-only or stale/non-TOTP actors, emits owner notice/audit, and maintains one active version/method. Concurrent activation/retirement versus checkout snapshots wholly old or new values; every existing order/submission/review continues against its exact destination version through payable expiry and no session compromise can rewrite pending transfer instructions.
- First/second proof rejection preserves exact price/reservations and starts one 24-hour window; third rejection cancels/releases. Approval fault/race tests execute both `PRODUCT` and `FUNDING_ADJUSTMENT` branches: the latter creates one adjustment payment/journal and zero product entitlements, restores the exact prior paid/partially-refunded and scheduled/active state only when every timely deficit is funded, and rejects/returns late top-up after access end. Forced source or applied-top-up reversal reopens the exact deficit/hold; full unwind reconciles all linked cash/allocations without duplicate refund. Repeated/concurrent commands cannot contradict any effect.
- Finance can approve, reject, reverse, and refund; unauthorized roles cannot view proof/reference or invoke the commands. Every proof access/decision is immutable-audited.
- Completed plus requested/processing/unknown refund reservations never exceed net refundable cash. Cancel works only before external action; timeout/late completion/rejection races preserve `UNKNOWN_RECONCILIATION_REQUIRED` until positive evidence and produce one cash-out sequence. Full requires `REVOKE_ACCESS`; partial immutable `KEEP_ACCESS/REVOKE_ACCESS` drives entitlement/review/allocation behavior. Refund/reversal after expiry leaves lifecycle `EXPIRED` but records revoked disposition, never attempts an illegal active-state transition.
- Confirmed wrong-value cash posts balanced unapplied-liability journals; return posts the exact inverse. Concurrent return/resolve cannot double-pay or close with a nonzero per-case balance, and finance/reconciliation exports expose every open unapplied amount without calling it revenue/payment approval.
- Student/guardian can view only authenticated in-app status/payment confirmation. No payment-status SMS/email job/template is emitted, and no receipt/tax-invoice generator, file, download endpoint, email attachment, or misleading label exists.
- Lack of pre-launch Egyptian legal/accounting review is recorded as the accepted owner risk and recommended follow-up, not misrepresented as a technical compliance pass or used to waive the technical payment gates above.

### 24.4 MCQ assessment durability

- Question/import validation requires exactly one correct option and two-six valid text/image options; meaningful passage/prompt/option images require academically equivalent alternatives that do not reveal correctness; subjective types cannot enter the objective engine.
- `.xlsx` phase one returns exact row/column/file errors and creates nothing. An image reference requires the scanned companion archive, boolean `is_complex`, reviewed short-alt column, and a long description iff complex; missing/contradictory alternatives and unused/duplicate/traversal/symlink/zip-bomb/wrong-type images fail. Repeated external IDs do not duplicate. Workbook plus images commit all-or-nothing.
- Editing a passage/group, question, option, mapping, framework, blueprint, timer or release setting creates a new version. A published assessment's frozen pool remains byte/version-identical for both existing and future attempts; newly edited/archived questions cannot enter or leave it. Cross-student selection uses only that pool and every attempt renders/grades the exact group passage/question/options it snapshots.
- Auto-grade writes immutable result revision 1. Regrade accepts only deterministic frozen-key/additive-option/award-all operations, never arbitrary marks or raw-answer edits; records old/new marks/pass/release plus actor/reason; and atomically updates progress. Released regrades stay visibly released, while unreleased results remain hidden. Regrade/void/progress-invalidation and dependent-start races serialize without rewriting completed downstream history.
- Randomized attempts resume with identical question and option order. Two concurrent exam starts create one attempt; quizzes permit unlimited new attempts.
- Autosave is idempotent, rejects stale revision, returns only after commit, survives API/worker restart simulation, and restores every acknowledged answer.
- Client clock manipulation cannot extend the deadline. Disconnect does not pause time. The API auto-submits expired attempts when the worker is unavailable; delayed worker cannot submit twice.
- Student-submit/timeout race yields one frozen submission and grade. Raw answers remain unchanged; earned/possible totals reconcile with the versioned answer key.
- A chapter/final attempt cannot reopen. Void alone grants no retry; one-time authorization is consumed once and audited.
- Immediate, after-window, and manual result-release policies hide/reveal results, correct choices, and explanations exactly as configured. Manual preview freezes exact current revisions; concurrent batch workers, retry, cancel-before-start, partial drift, release-versus-regrade/void, and repeated idempotency keys release each eligible current revision once and expose truthful per-item outcomes. Guardian/report/export/direct-ID routes cannot leak an unreleased result.
- Publication rejects `AFTER_WINDOW_CLOSE` without a finite frozen window end and verifies Cairo-input-to-UTC boundaries/DST. Launch attempts are explicitly unlimited for lesson quizzes and one for chapter/final plus one-use authorization; no per-question timer or configurable max-attempt control appears.
- Tab/blur/fullscreen/reconnect events warn and log but never modify score, accuse, auto-fail, or prematurely submit.
- Result/PDF/XLSX exports equal database totals and apply permission/branch scope; unreleased answers/results cannot leak through exports or guardian/report endpoints.

### 24.5 Added July target gates

- With each flag off, new feature entry routes return feature-unavailable behavior, navigation/search/dashboard/public metadata omit it, and no new module work starts; already committed submissions/reservations/reports/projections retain the bounded owner/operator access and reconciliation/grading/retention/recovery needed for safety. Shared P0 behavior remains unchanged. Assignment prerequisite/denominator tests prove no always-enabled item depends on assignment and on-to-off cannot relock P0 content. Coupon on-to-off during pending proof/review, zero-due race, rejection/expiry, approval, refund, restore and replay consumes/releases each grandfathered reservation exactly once.
- Assignment gate covers optimistic/idempotent draft autosave/reload across refresh/deploy, stale and save-versus-submit races, clean attachment-intent association, abandoned-draft warning/purge, upload recovery, text/file limits, malware handling, immutable submit snapshots, attempts, grader claim race, rubric totals, comments/annotations, regrade history, 48-hour reminders, permissions, and notification.
- Practice gate covers every filter, max 50, deterministic resume, immediate explanations/recommendations, access scope, and proof that no official grade/attempt changes.
- FAQ gate proves questions remain private, guardian/unrelated users cannot read them, publication is a separate permissioned moderation action, projection contains no identity/attachment, and only entitled course learners can search/view it.
- Coupon gate includes arithmetic, one-code, scope, limits, expiry, reporting, concurrency, refunds, and upgrade interaction.
- Monthly-report gate verifies one immutable authoritative snapshot/revision per student/Cairo month, excludes unreleased results, rechecks the guardian link at generation and every authenticated in-app view, and proves multi-child isolation. V1 creates no SMS/email delivery. Transfers/revocations and corrections never expose a stale child or drift metrics. `CAIRO_STREAK_V1` tests its time boundaries, excluded activity, late-event recompute and immutable supersession.

### 24.6 Outbox, retention, audit, and security

- Crash after business commit but before enqueue leaves an outbox row that dispatches after recovery. Duplicate dispatch/consumer retry cannot duplicate external effect.
- Crash before call, after provider acceptance, before confirmation, and during reconciliation drives `IN_FLIGHT/UNKNOWN/CONFIRMED` correctly. Stable provider keys/lookups resolve uncertainty where possible; CEQUENS unknown sends are never blindly retried, and no channel is marked delivered before evidence.
- Dead-letter/replay preserves original event/effect identity, actor/reason, and idempotency.
- Announcement tests prove permissioned audience preview, immutable content/criteria/recipient snapshot, cohort/course/persona isolation, one recipient under concurrent schedulers, test-send isolation, pre-send cancel, no recall after fan-out, active guardian/account/email/marketing-consent recheck, no payment/security-template or ordinary-SMS misuse, honest delivered/bounced/suppressed/unknown counts, and exact 12/24-month direct-mapping/content/aggregate retention without recipient leakage into long-lived audit.
- Support tests cover idempotent create/reply, every named transition, 15-minute claim expiry/reclaim, concurrent claim/reply/resolve, staffed-time pause, urgent-exam escalation/10-minute clock, seven-day reopen/auto-close, student ownership, guardian current-child-link loss, category/role scope, internal-note exclusion, attachment isolation, safe notifications, no proof/private-Q&A/answer leakage to ordinary support, and the exact attachment/direct-content/account-deletion retention boundaries.
- Scheduled publication, entitlement expiry, payment/assignment reminders, exam timeout, report generation, and retention jobs remain duplicate-safe across concurrent workers and Cairo date boundaries.
- Sole-primary guardian and last-active-owner deletion requests fail before restriction until a verified replacement completes; request/transfer/revoke/block races preserve those invariants. ACTIVE/SUSPENDED/BLOCKED/pending requests snapshot the exact restoration state; cancel-before-freeze restores it, while cancel-versus-admin hold/lift serializes and never defaults to ACTIVE. Fault injection before external `DELETE_DUE`, after provider acceptance/unknown response, after confirmation, before/mid/after local anonymization, and before/after `DELETE_COMPLETED` proves PII is never anonymized without a durable off-provider due intent and every retry is idempotent. Restoring a database/object generation from before either event cannot pass readiness until the verified external chain replays every expired due intent, resurrected direct identifiers/files are removed, and checkpoint/scans pass. Payment proof, private Q&A, support, announcement, watch/security/session/product-event records purge at their exact schedules and holds expire safely.
- Product analytics accepts only the documented event-code/payload schema, derives actor/scope server-side, rejects arbitrary properties, contains no direct identity/free text/answers/references/URLs, and produces correct nonidentifying aggregates before raw-event purge.
- Student and guardian data-export endpoints require recent password+OTP; include the specified profile/link, commerce, progress-correction, released academic, review/display-consent, testimonial/marketing/policy-consent, notification/preference, own-support, and safe security-event scopes; exclude other users, staff internals, private child Q&A/support, unreleased keys/results, and security/provider material. They neutralize CSV formula cells, reauthorize download, expire in 24 hours, produce in-app readiness only, and audit access.
- Direct SQL attempts to update/delete audit rows fail. Chain validation detects modified, reordered, or missing event content.
- Automated authorization tests cover every object route. Security tests cover CSRF, exact CORS, cookie flags, open redirect, stored/reflected XSS, injection, SSRF, malicious upload, rate-limit bypass, sensitive error/log redaction, and signed-link scope/expiry.
- No unresolved critical/high vulnerability affecting P0 authentication, authorization, payment, assessment durability, private data/files, or audit may be waived for the July deadline.

### 24.7 Core release decision

Public core is not backend-ready if any test shows an authentication/session/device bypass; guardian/student/staff IDOR or privilege escalation; TOTP bypass; payment double decision/arithmetic mismatch/unbalanced ledger/duplicate entitlement; access before approval; lost acknowledged answer; incorrect server timer or reopened exam; private proof/file/video-source exposure; mutable audit history; or failed deletion behavior.

Assignments, published FAQ, coupons, monthly reports, and practice may remain server-disabled independently when their own acceptance suite is incomplete. Disabling them cannot be used to hide a defect in shared identity, authorization, files, jobs, commerce, entitlements, curriculum, content, media, assessments, audit, or privacy code.

---

## 25. Production Architecture and Technology Baseline

### 25.0 Authoritative Lean V1 stack

V1 has exactly two expected paid items: the Hostinger KVM 4 subscription and the domain. Before purchase, treat the actual Hostinger checkout/hPanel plan details as authoritative; the July 2026 planning profile is 4 vCPU, 16 GB RAM, 200 GB NVMe and 16 TB monthly bandwidth. Do not add a paid streaming provider, database, object store, OTP/SMS, application email, load balancer, second node, Sentry or managed cache to the launch bill.

Run Ubuntu 24.04 LTS with Docker Compose: NGINX, two Next.js apps, NestJS API, worker, PostgreSQL, Valkey, ClamAV, backup agent and node monitoring. Cloudflare Free proxies the website/API/admin hostnames; the HLS media hostname is **DNS-only** and points directly to Hostinger because ordinary Cloudflare Free/Pro/Business website delivery is not the approved video CDN path. Cloudflare R2 Standard free allowance is used only for compact encrypted off-host database/config/audit backups at launch—not as the default video origin. Better Stack free allowances and a private Telegram bot provide external uptime/ops alerting. Every external integration remains behind an adapter.

The V1 launch blocker is evidence for the measured KVM 4 workload, restore, authorization and data integrity—not a fictional 2,000-concurrent or N-1/HA promise. Seed 3,000 accounts, test the V1 scenarios in section 33, and publish no concurrency guarantee before observing production traffic.

### 25.1 Delivery reality

The period from 13 July through 31 July 2026 spans eighteen elapsed days and nineteen inclusive calendar dates, with no contingency. This is an exceptionally high-risk schedule for a new system that handles minors, money, protected media, graded work, and synchronized examinations. The date can be attempted only by freezing P0 immediately, beginning vendor onboarding on day one, making same-day owner decisions, using production-like staging, and refusing late redesign.

The deadline never overrides these blockers:

- Authentication, session, guardian-boundary, device, or role bypass.
- Cross-student, cross-guardian, cross-branch, or cross-staff data exposure.
- Payment arithmetic, duplicate-decision, ledger, upgrade-credit, or entitlement mismatch.
- Loss of an acknowledged exam answer, duplicate submission, incorrect timer, or unauthorized extra attempt.
- Exposure of payment proof, private file, signed media source, secret, or audit data.
- A failed backup restore or inability to demonstrate the one-hour RTO and fifteen-minute RPO targets.
- An unresolved critical or high security defect affecting a P0 trust boundary.
- Failure to pass the accepted two-thousand-concurrent-user capacity profile.
- Failure to complete the planned 30–50-person real-device pilot.

The owner may document and waive only noncritical defects. If a blocker remains, keep transactional registration, payments, and examinations closed; the public marketing site and external status page may still be published. Added July targets remain independently disabled when their own gate fails.

### 25.2 Deferred funded production stack — do not provision for V1

Resolve and pin exact compatible patch versions at implementation kickoff. Commit the resulting pnpm lockfile and production image digests. Never deploy floating latest tags or unbounded dependency ranges.

| Layer                               | Required baseline                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Runtime                             | Node.js 24 LTS                                                                                        |
| Language/package tooling            | Strict TypeScript, pnpm workspaces, ESM where supported                                               |
| Public/student/guardian web         | Next.js 16 App Router and React 19                                                                    |
| Staff administration web            | Separate Next.js 16 App Router application                                                            |
| API                                 | NestJS 11 modular monolith using Fastify                                                              |
| Worker                              | Separate NestJS application context and BullMQ-compatible consumers backed by the PostgreSQL outbox   |
| Database access                     | Prisma ORM 7 with PostgreSQL driver adapter                                                           |
| Source of truth                     | DigitalOcean Managed PostgreSQL in Frankfurt                                                          |
| Cache and coordination              | DigitalOcean Managed Valkey; never authoritative for critical data                                    |
| File storage                        | Private DigitalOcean Spaces plus encrypted off-provider copies in Backblaze B2 EU Central (Amsterdam) |
| Video                               | Bunny Stream with MediaCage Basic DRM                                                                 |
| Edge                                | Cloudflare Pro for DNS, CDN, TLS, WAF, DDoS protection, Turnstile, and origin shielding               |
| SMS/OTP                             | CEQUENS through an internal provider adapter                                                          |
| Email                               | Postmark through transactional and broadcast streams                                                  |
| Error and performance telemetry     | Sentry with PII disabled and no session replay                                                        |
| Logs, uptime, alerts, public status | Better Stack plus email and Telegram alert routing                                                    |
| Testing                             | Vitest, Testcontainers, API integration tests, Playwright, axe-core, and k6                           |
| Deployment                          | Ubuntu 24.04 LTS, Docker Engine and Compose v2, NGINX, private GHCR                                   |
| Infrastructure as code              | Terraform with encrypted remote state; Ansible for repeatable host configuration                      |
| CI/CD                               | Private GitHub repository and GitHub Actions protected environments                                   |

Do not introduce Kubernetes, service meshes, event brokers, or independent microservices for launch. Reconsider them only after measured scale or operational evidence shows the modular monolith and horizontal replicas are the constraint.

### 25.3 Architecture principles

- PostgreSQL is authoritative for accounts, sessions, devices, guardians, orders, ledger entries, entitlements, progress, answers, grades, notifications, feature flags, outbox events, and audit history.
- Valkey may accelerate sessions, cache read models, enforce distributed rate limits, coordinate short activity leases, and deliver jobs. Losing it may log users out or delay work, but cannot lose critical state.
- API and worker domain modules communicate through application services and versioned domain events, never by importing another module’s private repository.
- Both web applications consume a generated client from the committed OpenAPI contract. They do not maintain handwritten duplicate DTO definitions.
- Application nodes are stateless and require no sticky load-balancer session.
- All user-visible asynchronous work has a durable status. A provider timeout must not create an ambiguous financial or exam state.
- All production components expose safe liveness and readiness checks and identify the immutable release SHA.

## 26. Monorepo and Environment Contract

### 26.1 Repository layout

    bahrawy-academy/
      apps/
        academy-web/          public site, student PWA, guardian portal
        staff-admin/          isolated staff application
        api/                  NestJS HTTP API
        worker/               outbox, files, reports, exports, notifications
      packages/
        domain/               framework-independent rules and state machines
        db/                   Prisma schema, migrations, seeds, generated client
        contracts/            OpenAPI output and generated typed API client
        ui/                   shared RTL-aware design system
        config/               typed environment parsing and feature flags
        observability/        logging, tracing, Sentry, redaction
        testing/              factories, fixtures, mocks, test containers
      infra/
        terraform/
          modules/
          environments/
            staging/
            load/
            production/
            dr/
        ansible/
      deploy/
        compose/
        nginx/
      ops/
        runbooks/
        checklists/
        incident-templates/
      docs/
        adr/
        architecture/

Applications may depend on packages; packages must not depend on applications. The domain package stays free of NestJS, Next.js, Prisma, HTTP, and provider SDK code. Provider implementations sit behind application-owned interfaces.

Configure pnpm supply-chain protections: frozen lockfile in CI, registry integrity checks, minimum package age where supported, explicit packages allowed to run install scripts, and a reviewed dependency-update workflow. Generate an SBOM for each release.

### 26.2 Hostnames

The owner must purchase an academy-owned domain before production setup. Use these logical names, replacing the example root:

| Host                          | Purpose                                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| academy.example               | Public marketing and authenticated student/guardian PWA                                                         |
| admin.academy.example         | Staff administration                                                                                            |
| assets.academy.example        | Shared immutable Next.js/static release assets backed by versioned object storage/CDN; never user-private files |
| status.academy.example        | External Better Stack status page alias                                                                         |
| staging.academy.example       | Staging public/student surface                                                                                  |
| admin-staging.academy.example | Staging staff surface                                                                                           |

Both user-facing hosts expose their own same-origin API path under /api/v1 through the reverse proxy. Student and staff session cookies are host-only and never scoped to the parent domain. The NestJS service remains a shared internal deployment but validates the exact Origin, session kind, and permission on every request.

### 26.3 Environments

| Environment              | Data and integrations                                                                                                                              | Purpose                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Local                    | Synthetic fixtures, local PostgreSQL/Valkey, fake provider adapters                                                                                | Fast development and tests                                                                                          |
| CI                       | Disposable Testcontainers and deterministic provider fakes                                                                                         | Repeatable validation                                                                                               |
| Staging                  | Synthetic accounts/content; vendor sandboxes or test destinations; small persistent topology                                                       | Functional E2E, security review, accessibility, provider smoke, ordinary migration rehearsal; not capacity evidence |
| Ephemeral load/rehearsal | Production-size two-app/worker/LB plus isolated production-plan PostgreSQL/Valkey and production-volume synthetic data; fake/allowlisted providers | 2,000-concurrent, N-1, spike/soak, and large-migration proof; created from Terraform and destroyed after evidence   |
| Production               | Real academy data and production vendor credentials; initially access-restricted to approved pilot accounts                                        | Pilot from 26/27 July, then staged public operation                                                                 |
| DR                       | Current signed images and replicated/recoverable data, normally no user traffic                                                                    | Regional recovery                                                                                                   |

Production PII must never be copied to local, CI, staging, or the ephemeral load environment. If production-derived performance shapes are needed, generate synthetic data with matching distributions. Test SMS/email destinations are an explicit allowlist so nonproduction cannot message real students accidentally. The load environment uses a separate project/VPC/DNS/database/object prefix, contains no production credentials, is torn down after final test/retest, and retains only redacted metrics, test scripts, configuration, and signed results. Its short-lived compute/database cost is an excluded burst/load-test expense, approved before provisioning.

Restricted production is enforced by application state, not an obscurity header: public marketing/legal/health GETs may remain reachable, while student registration/claim/login and student/guardian commerce/writes check admission `RESTRICTED` plus an active `pilot_access_entry` or a current relationship to an allowed pilot student. A live unexpired guardian invitation whose invited-phone HMAC matches the proved phone and whose student is pilot-allowed grants only invitation start, OTP/login/setup, policy acceptance and link-completion routes; it grants no dashboard, other child, commerce, report or ordinary guardian route. Expiry/revoke/phone mismatch removes that onboarding capability immediately; after commit the normal current-link predicate replaces it. Active staff use normal staff authentication/authorization and every `admin` request additionally validates the Cloudflare Access JWT audience/signature plus its active bound `staff_access_identity`; they do not need a student pilot entry. There is no shared pilot password, URL parameter, cookie flag, IP-only exception, or client-side bypass. Provider callbacks and scoped monitors bypass only pilot membership, never ordinary controls. Public launch is the named audited admission transition and stops creating pilot-only entries without deleting evidence.

Pilot entry creation normalizes a submitted phone server-side, stores only keyed HMAC/safe last-four, or binds an existing account ID; it requires persona, scope, expiry, reason, expected version, idempotency, and owner audit. Phone verification/registration atomically binds the matching entry to the new account without exposing whether an entry exists. The maximum-100-row JSON batch is validate-then-commit with row errors and no partial mutation; duplicate account/phone/persona rows reconcile deterministically and arbitrary fields are rejected. Revoke/expiry blocks the next admission check but does not break a guardian whose access still derives from another allowed linked child. No endpoint exports raw phones. Opening public admission requires the signed stage-gate release record; re-restriction requires an incident/rollback record and never substitutes for a targeted security block or kill switch. Ninety days after opening public admission, purge preregistered HMAC/last-four, direct pilot account mappings and import row payloads unless admission was formally re-restricted; account deletion purges that subject's mapping immediately. Retain only nonidentifying batch count/outcome and actor/action audit.

### 26.4 Configuration and feature flags

- Validate every environment variable at process startup; missing or malformed required values fail readiness.
- Keep public configuration separate from server secrets.
- Each added July target has a server-owned flag: assignments, published FAQ, coupons, monthly reports, and practice bank.
- A disabled feature returns a stable not-available response from its API, holds/rejects only work owned by that module, disappears from web routes/navigation, remains absent from marketing claims, and can never be used as a prerequisite or required progress item while disabled. Flag changes use the named API, owner permission, recent non-replayed TOTP, expected version/idempotency key, reason, audit/outbox, and release evidence.
- Emergency kill switches are independent durable controls for registration, new order creation, payment review, playback initiation, exam starts, subjective submissions, outgoing SMS, and outgoing email. A `CLOSED` control wins over optional flags, product/content state, rollout state, stale cache, and client UI. PostgreSQL is authoritative; cache loss reloads it, and database/control-read uncertainty makes controlled mutations fail closed and readiness fail rather than assuming `OPEN`. Startup loads every seeded code and refuses readiness on a missing/unknown control.
- `REGISTRATION` blocks new student registration and roster-claim start/finalize but allows existing login/recovery and already-invited guardian setup; `ORDER_CREATION` blocks new order commits while existing orders/status/proof workflows continue; `PAYMENT_REVIEW` blocks new claims/approve/reject while confirmed decisions and reconciliation continue; `PLAYBACK_INITIATION` blocks new sessions and token renewals, so existing CDN authority expires within the 90-second fence; `EXAM_START` blocks new attempts while existing autosave/submit/timeout continues; `SUBJECTIVE_SUBMISSION` blocks new assignment starts/final submission while preserving already submitted grading; outbound controls hold new unsent provider effects while provider-accepted/unknown effects reconcile and durable domain notifications remain queued. Reopening never replays an effect twice.
- Close/reopen requires the named owner command, recent TOTP, `If-Match`, idempotency, reason, incident/release reference, and audit/outbox. `reviewAt` only alerts; no switch auto-reopens. A protected operations-shell command with the same database transaction, TOTP replay protection, expected version, reason, and audit is the break-glass control path when staff UI is unavailable; it is not a second secret/default account.
- Admission `RESTRICTED` additionally requires an active pilot entry or an allowed-student-derived guardian relationship for public student/guardian registration/claim/login/commerce, except the narrowly scoped live matching-phone guardian-invitation onboarding capability in section 26.3, which permits only acceptance/setup routes. Active staff under normal staff controls, authenticated provider callbacks, and scoped monitors bypass only this membership predicate. `PUBLIC` removes that predicate without deleting entries/evidence. Restrict/open-public transitions are named, audited, versioned, and tied to a signed rollout/rollback record.

### 26.5 Frontend architecture and component contract

- Use Next.js App Router route groups to isolate public, authentication, student, and guardian layouts in `academy-web`; keep the staff layout and build in `staff-admin`. Each group owns its navigation, error boundary, loading boundary, not-found state, and authorization-aware shell.
- Prefer React Server Components for public pages, read-heavy authenticated entry views, and metadata. Add Client Components only at the smallest boundary that needs interaction, browser APIs, polling, media, forms, or optimistic UI. Never ship staff code in the public/student application bundle.
- Use the generated OpenAPI client as the transport contract. Use TanStack Query for interactive server state, polling, invalidation, and mutations; use server `fetch` for server-rendered reads. Define one cache owner per request so a screen does not independently cache the same record in Next.js, TanStack Query, and ad hoc component state.
- Use React Hook Form with generated/shared Zod-compatible client schemas for immediate feedback. The API repeats every validation and authorization check; browser validation is never trusted. Preserve valid fields and uploaded-object references after a field error.
- Use `next-intl` message catalogs even though launch UI is Arabic-first, with `ar-EG` as the only exposed UI locale. No user-facing production string is scattered through JSX. English lesson content is content data, not an application-locale switch.
- Build the shared UI package from semantic design tokens and accessible primitives: buttons, links, fields, OTP/code inputs, select/combobox, tabs, dialogs, drawers, toasts, banners, cards, tables, pagination, upload, progress, timers, skeletons, empty/error panels, and charts. Components expose documented size/state/intent variants; screens do not invent raw colors, shadows, focus styles, or z-index values.
- Use CSS logical properties and a root RTL direction. Components must not encode `left/right` where `inline-start/inline-end` is intended. Phone, code, URL, reference, and English-content islands follow the direction rules in section 9.
- Keep local UI state in the nearest component or URL search parameters. Do not introduce a global Redux-style store for server records. A tiny global client store is allowed only for nonauthoritative shell preferences such as theme and Data Saver.
- Every route has colocated loading, empty, expected-error, unexpected-error, offline, forbidden, and expired-session handling. Unexpected failures show a safe support reference tied to the trace ID and can recover without a full blank screen.
- Destructive/financial actions use accessible confirmation dialogs and server-returned results. Toasts never carry the only copy of an error, decision, payment state, or exam save state.

### 26.6 Frontend data, mutation, and privacy rules

- Query keys include organization, role/surface, authenticated account, and child/student scope where applicable. On logout, account switch, guardian child switch, role change, or session expiry, cancel in-flight requests and remove inaccessible cached records before rendering the next scope. A late response from child A must never paint into child B's screen.
- Never optimistically approve a payment, activate/revoke an entitlement, submit/grade an attempt, change a guardian link, remove a device, or alter account state. Optimistic UI is limited to safely reversible presentation actions such as marking a notification read; authoritative mutations render the committed server result.
- Every retryable command creates and retains one idempotency key for that logical user action. A retry after timeout reuses it; a deliberate new action generates a new key. Disable duplicate controls while the request is unresolved but still handle concurrent server requests correctly.
- Authentication state comes only from the host-only HttpOnly session cookie and `/auth/session`; no access token, refresh token, OTP, TOTP, signed URL, proof URL, or Bunny token enters local storage, session storage, a query-persistence plugin, analytics, or error telemetry.
- Assessment order, deadline, released status, and saved-answer revisions are server-authoritative. The client calculates display time from a periodically refreshed server-time offset and never extends a deadline from the device clock.
- To survive a brief disconnect or refresh without pretending that exams work offline, maintain a per-attempt IndexedDB outbox containing only unsent selected-option IDs, client sequence, and timestamps. Encrypt-at-rest only if a robust browser key design is available; regardless, bind it to account/attempt/device, expire it after 24 hours, purge it on acknowledged submit, logout, account switch, or terminal attempt, and never cache correct answers or explanations before release. The UI distinguishes **saved on server**, **waiting to save**, and **save failed**.
- A reconnect first fetches the authoritative attempt, merges only still-unacknowledged higher client revisions, sends them with expected revisions/idempotency keys, then confirms the server result. Conflict UI must never silently discard either copy.
- Direct uploads display validation, hash/intent creation, byte progress, server receipt, scanning, clean/rejected, and domain-attachment states separately. Navigating away warns only while bytes or a finalization command are genuinely pending; an already finalized upload can resume by its server ID.
- Polling pauses when the tab is hidden except where an active player/exam or explicit SLA queue requires it. Reconnects use jitter and bounded exponential backoff; foreground/refocus performs a safe revalidation without creating mutations.

### 26.7 PWA, cache, and update behavior

- Ship a valid web manifest with canonical academy name, short name, theme/background colors for both schemes, maskable and standard icons, standalone display, Arabic direction/language, and start URL. Installability is an enhancement; every journey works in a normal browser tab.
- Use a versioned service worker with an explicit allowlist. Precache only the minimal application shell, local fonts/icons, offline page, and fingerprinted static assets. Runtime-cache only anonymous public GET responses proven safe to share.
- Never service-worker-cache authenticated HTML/API JSON, assessment definitions, answers, guardian data, payment data/proofs, support/Q&A, reports, private PDFs, signed URLs, video manifests/segments/tokens, or staff pages. Set and test `Cache-Control: private, no-store` on those responses; clear all app caches on logout/account switch.
- Offline mode offers a branded status page, cached public navigation where safe, and visibility of an already loaded form's local unsent state. It does not advertise offline lessons, video, PDFs, exams, payments, or staff operations.
- A newly installed service-worker version must not force reload during an active exam, playback, upload, or unsaved form. Announce an update, activate after the critical activity becomes safe, and retain one previous compatible asset set long enough for controlled activation. A release never strands a loaded exam on missing chunks.
- Theme and Data Saver are the only launch preferences persisted broadly on-device. Data Saver follows section 9.4 and never disables security, autosave, timer sync, or required educational content.
- Do not add web push, SMS or application email at launch. In-app is the only V1 user notification channel; any later external channel requires consent, verification, lifecycle, quiet-hours, privacy, provider and cost design.

### 26.8 Public discovery, performance, and product analytics

- Server-render the homepage, product storefront/detail, included academic course summaries, public review pages, FAQ, legal, and selected full preview lesson metadata. Supply unique Arabic titles/descriptions, canonical URLs, Open Graph imagery, sitemap, robots policy, and truthful Schema.org `Organization`, `Person`, `Course`, `Offer`, and review markup only when the displayed production facts exist.
- Draft, staging, authenticated, payment, assessment, guardian, support, file, and staff routes are `noindex`; staging also has authentication/IP controls and a site-wide search-engine block. Never expose private content through metadata, page source, prefetch payloads, sitemap, social cards, or structured data.
- Use responsive AVIF/WebP images, explicit dimensions, lazy loading below the fold, and a real teacher-photo focal crop. Self-host a licensed Arabic-capable variable font or the smallest required WOFF2 subsets/weights; avoid third-party font requests.
- At p75 on representative Egyptian mobile traffic, target Core Web Vitals of LCP <=2.5 s, INP <=200 ms, and CLS <=0.1 for public and core student pages. On the defined constrained profile, the initial public/student shell should keep first-load compressed JavaScript near or below 200 KB per route and avoid any nonessential request before the primary action is usable. Record exceptions with a measured reason and remediation owner.
- Route-split the video player, charting, rich staff editor, spreadsheet tooling, and PDF viewer so they load only when used. Data Saver disables decorative prefetch; Next.js link/image prefetch is reviewed per route rather than accepted blindly.
- Record allowlisted first-party product events through the API/outbox, not third-party advertising pixels: registration stage, claim stage, checkout stage, playback start/error/completion, assessment start/save failure/submit, support creation, and feature adoption. The server derives actor/scope; the client sends no phone, name, free text, answers, payment reference, file URL, or arbitrary event name.
- Retain raw pseudonymous product events for 90 days and longer-lived aggregates without direct identifiers. Do not install Google Analytics, Meta Pixel, ad networks, heatmaps, or session replay at launch. Any later marketing tracker requires a separate minors/privacy/consent decision and must not run before consent.

### 26.9 Frontend proof

- Maintain a component/state harness covering light/dark, Arabic RTL, mixed-direction content, 320/360/390/768/1024/1440 widths, loading, empty, long text, validation, offline, forbidden, and error variants. Use it for visual regression rather than relying on happy-path screenshots.
- CI runs type checks, lint/format, unit/component tests, axe checks, production builds for both apps, bundle-budget checks, and Playwright journeys. Browser tests assert cache headers, noindex policy, guardian cache isolation, idempotency-key reuse, server-time behavior, service-worker exclusions, and no sensitive values in storage or telemetry.
- Production RUM captures Core Web Vitals, route/release, coarse device/network class, and safe error correlation only. Dashboards segment public, student, guardian, staff, player, and assessment performance without direct student identity.

## 27. Production Topology, Network, and Data Services

### 27.0 Authoritative single-VPS topology

```text
Students/guardians/staff
  |-- Cloudflare Free proxied: app/API/admin (DNS, TLS, WAF/rate rules)
  `-- DNS-only media hostname: private signed HLS
                         |
                    Hostinger KVM 4
  NGINX -> academy-web / staff-admin / API -> PostgreSQL
                                      |----> Valkey
                                      |----> worker / ClamAV
                                      `----> private files + HLS on NVMe
                         |
       encrypted database/config/audit backups -> Cloudflare R2
       uptime/log alert summaries -> Better Stack / Telegram
```

Suggested RAM ceilings, tuned after measurement: PostgreSQL 4 GB; API 1.5 GB; worker 1.5 GB; ClamAV 2 GB; student web 768 MB; staff web 512 MB; Valkey 512 MB; NGINX 256 MB; OS/agents/filesystem cache about 2 GB; retain roughly 3 GB operational headroom. Never run FFmpeg/transcoding on this host. Cap worker concurrency and database connections so video delivery cannot starve exam/payment/auth APIs.

Keep at least 25% of disk free. Warn at 65% total use and page at 75%. Plan the 150 GB usable envelope across OS/images/releases (25 GB), PostgreSQL/Valkey (25 GB), uploads/files/logs (15 GB), and HLS (normally no more than 85 GB); whichever limit is reached first triggers migration/cleanup. Never delete a lesson still covered by an entitlement merely to clear an alert.

### 27.0.1 Media and bandwidth capacity model

- Curriculum assumption: four weeks × one two-hour lesson/week = **8 watch-hours per fully active student/month**.
- 3,000 fully active students therefore represent **24,000 viewing hours/month**, not 3,000 simultaneous viewers.
- With 720p default, 480p fallback and about 15% rewatch/protocol overhead, plan around **12 TB/month** as a forecast, not a guarantee. Instrument exact bytes by rendition and do not confuse registered students, monthly viewers and concurrent viewers.
- Bandwidth alerts: 8 TB advisory, 10 TB capacity review, 12 TB migration action. Confirm Hostinger's dashboard accounting/renewal date after purchase.
- Begin HLS migration to the `R2_EDGE`/specialized edge adapter when projected monthly transfer exceeds 12 TB, stored HLS exceeds the lower of 100 GB or the space remaining before 75% total disk use, concurrency exceeds the accepted load test, or media traffic harms API/exam SLOs. Complete it before the 16 TB plan ceiling; do not wait for an outage.

The single VPS is not HA. A VPS/provider fault can take the whole academy offline until rebuild/restore. This is an accepted V1 cost tradeoff and must be stated honestly.

### 27.1 Deferred funded HA topology — do not provision for V1

    Egyptian users
        |
        v
    Cloudflare Pro: DNS, TLS, CDN, WAF, Turnstile, rate limits
        |
        v
    DigitalOcean regional load balancer, Frankfurt
        |-----------------------------------|
        v                                   v
    App node A                          App node B
    NGINX                               NGINX
    academy-web                         academy-web
    staff-admin                         staff-admin
    API replicas                        API replicas
        |                                   |
        |-------------------|---------------|
                            v
                 Managed PostgreSQL HA
                 Managed Valkey
                 Private Spaces

    Isolated worker node ---> PostgreSQL / Valkey / Spaces
                           ---> Bunny / CEQUENS / Postmark

    PostgreSQL read replica + warm app in Amsterdam for regional DR
    On-demand Amsterdam Valkey + incident read-only B2 private-object adapter
    Immutable web assets mirrored to a separate B2/Cloudflare DR origin
    Spaces objects + encrypted logical backups copied to Backblaze B2 EU Central
    Sentry and Better Stack receive redacted telemetry

Launch resources:

- Two Frankfurt application droplets, each initially 2 vCPU and 4 GiB RAM.
- One Frankfurt worker droplet, initially 1 vCPU and 2 GiB RAM.
- One 4 GiB functional-staging droplet with local containerized PostgreSQL/Valkey and synthetic data; production builds run in CI, not on this host.
- One Terraform-defined ephemeral production-size load/rehearsal stack, provisioned only for the formal gates and destroyed after sanitized evidence is retained.
- One regional HTTP load balancer.
- Managed PostgreSQL primary with matching Frankfurt standby.
- A geographically separate read replica suitable for promotion during regional disaster recovery.
- Managed Valkey, initially 1 GiB.
- Private Spaces storage.
- A warm DR application node in the same region as the DR database copy.
- A Terraform path for an on-demand regional Valkey/second DR app/worker and an incident-only read-only B2 private-object adapter; no write-heavy function reopens until its DR dependency exists.

The two-node application size and smallest HA database plan are provisional. They are acceptable only if the production-equivalent k6 gate passes. If it fails, resize or add capacity and repeat the test; never weaken the 2,000-concurrent requirement.

### 27.2 Container placement

Each application node runs NGINX, academy-web, staff-admin, and exactly two API processes at the initial size, all within measured CPU/memory limits. The worker is isolated so PDF generation, imports, notifications, media reconciliation, and reports cannot starve exam autosaves. The initial database connection contract assumes a measured provider limit of 47 backend connections: API/PgBouncer budget 20 total across four API processes (five each), worker 6, migration 3, backup/reporting 3, emergency administration 3, and provider/maintenance headroom 12. Configure PgBouncer transaction pooling and Prisma connection limits/timeouts accordingly. Re-read the actual plan limit at provisioning and CI/deploy time; if it is lower or any workload cannot stay inside these budgets, choose a larger database plan and rerun load rather than borrowing the reserve.

The 4 GiB staging host has explicit container ceilings, initially academy-web 384 MiB, staff-admin 384 MiB, API 768 MiB, worker 512 MiB, PostgreSQL 512 MiB, Valkey 128 MiB, NGINX 64 MiB, with the remainder reserved for the OS/agents/overhead. Measure peak RSS during full E2E/import/export smoke. If memory pressure, OOM, or sustained swap appears, resize staging; do not reduce production/load evidence to fit it.

Containers:

- Run as non-root with read-only root filesystems where practical.
- Drop unnecessary Linux capabilities and enable no-new-privileges.
- Have CPU/memory limits, health checks, graceful shutdown, and bounded JSON logs.
- Never mount the Docker socket into an application container.
- Use immutable images pinned by digest.
- Store no durable user data on a droplet filesystem.

### 27.3 Edge and origin security

- Cloudflare SSL mode is Full strict. Enable DNSSEC and registrar lock.
- Add HSTS only after every production subdomain is confirmed HTTPS; preload only after a separate review.
- Cache fingerprinted static assets, public images, and safe public responses.
- Next.js release assets are not node-local at request time. Build once with deterministic per-app build/deployment IDs derived from the immutable release SHA. CI uploads `.next/static` and other fingerprinted public assets under distinct immutable `/academy-web/{deploymentId}/...` and `/staff-admin/{deploymentId}/...` prefixes before any node serves that release; source maps are excluded. Replicas serving the same release use the same app-specific `deploymentId`, and different apps/releases never share a namespace. Mirror the two manifests/prefixes to the public-static DR origin before rollout. Retain at least the current and prior three releases for seven days, verify checksums/edge and DR-origin reachability, and garbage-collect only prefixes no live/rollback release references.
- Do not use Next.js Server Actions at launch; all mutations use the versioned REST API. CI fails if a Server Action manifest/nonempty action entry appears. This avoids replica encryption-key drift and hidden mutation behavior. Use Next.js deployment skew protection so a client receiving a different deployment ID performs a safe full navigation; never force that navigation during an active exam/upload/player critical section.
- Explicitly bypass shared cache for authenticated HTML, /api, account data, payments, files, signed media, progress, questions, assessments, and reports.
- Use Cloudflare managed WAF rules, DDoS protection, suspicious-bot challenges, and Turnstile on abuse-sensitive forms.
- Mirror decisive rate limits inside the API; edge protection is defense in depth.
- Trust client IP only from Cloudflare/load-balancer headers after validating the request came from the trusted proxy path.
- Restrict origin ingress to Cloudflare/load-balancer traffic. Databases and Valkey accept only VPC/trusted-source traffic.
- No public database, Valkey, Docker API, or unrestricted SSH. Administrative access uses Cloudflare Access/Tunnel or an equivalently short-lived MFA-protected path.
- Host an external maintenance/status response that stays reachable during a Frankfurt outage.

### 27.4 PostgreSQL

Use the current DigitalOcean-supported PostgreSQL major chosen at provisioning; PostgreSQL 18 is the preferred July 2026 baseline if available in the selected region and plan. Configure:

- Primary and matching standby in Frankfurt for automatic failover.
- Daily managed backups and point-in-time recovery.
- A separate-region read replica monitored for lag and documented promotion.
- PgBouncer transaction pooling where compatible with the Prisma adapter.
- Dedicated roles for runtime API, worker, migrations, backup, and read-only reporting.
- SSL-only connections and trusted-source firewall rules.
- Slow-query capture, query insights, lock/connection dashboards, and storage autoscaling alerts.
- A maintenance window outside 10:00–22:00 Cairo support peaks and every scheduled exam freeze.

Database saturation is not solved by longer client timeouts. Fix query/index problems, then resize all relevant HA/DR nodes together when measured CPU, I/O, memory, connection, or storage thresholds demand it.

### 27.5 Valkey

Use managed Valkey for cache, rate-limit counters, short leases, distributed locks, and BullMQ delivery. Configure eviction only for rebuildable cache keys. Session and activity-lease caches must fall back to PostgreSQL truth. Payment, entitlement, answer, progress, audit, and outbox data never exist only in Valkey.

On Valkey outage:

- Continue safe PostgreSQL-backed reads/writes where rate and lease safety can be maintained.
- Fail closed for operations that require an uncontested distributed lease if the database fallback is unavailable.
- Rebuild caches and replay the PostgreSQL outbox after recovery.
- Do not duplicate queued side effects.

### 27.6 Private file storage

Use separate private prefixes or buckets for quarantine, approved learning resources, assignments, private questions, payment proofs, imports, exports, backups, and audit-chain roots. Public marketing images may use a separate public/CDN path.

Every finalized private object is copied asynchronously to encrypted Backblaze B2 EU Central storage outside the primary DigitalOcean failure boundary. Record primary-ready, backup-pending, backed-up, quarantined, and purged states in PostgreSQL. Alert when a finalized object remains without its B2 copy for more than ten minutes.

## 28. Backup, Disaster Recovery, and Cost Envelope

### 28.0 Authoritative Lean V1 backup, recovery, and cost

- Stream an encrypted PostgreSQL custom-format dump to private Cloudflare R2 every six hours; retain seven days of six-hourly copies, 30 daily copies and six monthly copies while staying within the free allowance. If backup volume would exceed it, reduce old non-required generations first or explicitly approve the small R2 charge—never silently stop backups.
- Back up deployment/config manifests, audit chain roots and the deletion journal daily. Secrets and encryption recovery material have two offline copies and are not stored only on the VPS or in R2.
- Treat any included Hostinger snapshot as convenience, not the off-provider backup. Production HLS can be rebuilt from the two offline master copies and encoding manifest; it does not need to consume the launch R2 allowance.
- Perform an automated restore verification weekly and a clean-VPS timed rebuild drill before launch and quarterly. Verify account/guardian, payment/ledger/entitlement, progress, an exam answer/submission, a private file reference and audit-chain continuity.
- Honest initial targets are **RPO ≤ 6 hours** for a total VPS/provider loss and **RTO ≤ 4 hours** when Hostinger, DNS, repository, credentials and the operator are available. Ordinary container rollback should be much faster. These are internal tested objectives, not a public SLA.
- Recurring V1 cost table: Hostinger KVM 4 at the actual purchased/renewal price; domain at the registrar's actual renewal price; Cloudflare Free/R2 within allowance, Better Stack within allowance, Telegram, PostgreSQL, Valkey, NGINX, FFmpeg and ClamAV at $0 software/service charge. Payment fees and operator time are business costs, not hosting subscriptions. Configure billing alerts because a “free tier” is a limit, not an unlimited guarantee.

### 28.0.1 Deferred material below

Sections 28.1–28.4 describe a future funded multi-provider/HA target and do not apply to V1 provisioning, launch cost, RTO/RPO promises or acceptance.

### 28.1 Deferred funded backup policy

| Asset                        | Schedule                                                                                                                                        | Retention and verification                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Managed PostgreSQL           | Continuous provider WAL/PITR plus daily backup                                                                                                  | Use the available PITR window; verify provider status daily                                            |
| Logical PostgreSQL dump      | Nightly encrypted custom-format dump to Backblaze B2 EU Central                                                                                 | 14 daily, 8 weekly, 12 monthly; monthly restore test                                                   |
| Private objects              | Copy after clean finalization                                                                                                                   | Backblaze B2 copy expected within 10 minutes; daily manifest reconciliation                            |
| Immutable web release assets | Mirror each per-app deployment prefix to the B2/Cloudflare static DR origin before rollout                                                      | Current plus prior three releases for at least 7 days; checksum and failover fetch on every release    |
| Terraform state              | Encrypted remote state with locking and version history                                                                                         | Never store only on an operator laptop                                                                 |
| Vendor configuration         | Weekly export where provider API permits                                                                                                        | Cloudflare, Bunny metadata, Postmark templates, CEQUENS configuration, monitors                        |
| Audit roots                  | Daily immutable chain-root copy                                                                                                                 | Verify chain during restore drills                                                                     |
| Deletion tombstone journal   | Conditionally append and verify `DELETE_DUE` before local anonymization; reconcile/append `DELETE_COMPLETED` afterward; checkpoint every backup | Minimum 18 months and longer than oldest backup; mandatory due-intent replay before restored readiness |
| Application nodes            | No durable backup                                                                                                                               | Rebuild from IaC, Ansible, signed images, and secrets                                                  |

Backblaze B2 EU Central is the selected off-provider object boundary. Use dedicated private buckets/prefixes, opaque keys, client-side envelope encryption for database dumps/highly sensitive backup sets plus B2 server-side encryption, scoped write/list credentials for the copier, separate offline-controlled restore credentials, versioning/lifecycle, and Object Lock for logical backups/audit roots where retention permits. The routine application runtime cannot delete or read immutable backup prefixes. Keep encryption recovery material outside both DigitalOcean and Backblaze, with two offline copies. A backup is not accepted until it has been restored and the restored system has passed integrity checks.

Run copying/backups in a dedicated hardened `backup-agent` identity/container, not the API or ordinary domain worker. The object copier receives only final object ID/version/hash through the outbox, can write/list the designated B2 copy prefix but cannot read user-facing data through application APIs or delete retention-locked backups. A separately isolated deletion-journal sub-identity receives only the stable non-PII deletion operation/event, may conditionally create and head/list the immutable journal prefix, and cannot overwrite/delete objects or read application PII; its confirmation is required before local deletion proceeds. The logical-dump job uses the read-minimum `backup` database role, streams `pg_dump --format=custom` through client-side authenticated encryption without leaving an unencrypted durable file, uploads with checksum/manifest, downloads a bounded verification sample, and emits a heartbeat only after all checks pass. A separately scoped retention credential/job may delete only database-approved expired objects after legal-hold/tombstone checks. Restore/read credentials and envelope-recovery keys remain offline and are injected only during a declared drill/incident; every use is logged outside the restored system. Daily reconciliation compares PostgreSQL final-object manifests with B2 versions in both directions and pages on missing, wrong-hash, unexplained-extra, or over-retained data.

### 28.2 Deferred funded recovery objectives

| Failure                     |                                      Target RTO |                               Target RPO | Recovery mechanism                                         |
| --------------------------- | ----------------------------------------------: | ---------------------------------------: | ---------------------------------------------------------- |
| One app node                |                                 Under 5 minutes |                  Zero critical-data loss | Load balancer removes it; stateless traffic continues      |
| Worker node                 |                                Under 15 minutes |                   Zero critical-job loss | Rebuild and replay PostgreSQL outbox                       |
| PostgreSQL primary          | Under 5 minutes where managed failover succeeds |                                Near zero | Standby promotion and connection retry                     |
| Accidental write/corruption |                                Under 60 minutes |                       At most 15 minutes | PITR into a new cluster, verify, then repoint              |
| Frankfurt regional outage   |               Degraded service under 60 minutes |                       At most 15 minutes | Promote DR replica, activate warm origin, route Cloudflare |
| Primary object loss         |                                Under 60 minutes | At most 15 minutes for finalized objects | Restore Backblaze B2 object and manifest                   |
| Valkey loss                 |                                Under 30 minutes |                    No critical-data loss | Recreate, rebuild cache, replay outbox                     |

These are tested operational targets, not a contractual cloud SLA. The stated fifteen-minute database RPO applies to a primary-node, Frankfurt-cluster, and Frankfurt-region failure while the managed cross-region replica/PITR boundary remains available. The independent nightly B2 logical dump protects against a DigitalOcean account/provider-wide catastrophe but has an explicit worst-case database RPO of 24 hours plus dump duration; meeting fifteen minutes across that boundary would require a separately funded, continuously replicated off-provider PostgreSQL/WAL design and a new restore test. Record this limitation in the release risk register and never advertise the normal RPO as an all-provider guarantee. Before launch, execute a timed restore that verifies one account/guardian link, one approved payment and ledger, its entitlement, a lesson progress record, an acknowledged exam answer/submission/grade, a private file, and an audit-chain segment.

### 28.3 Deferred funded regional disaster sequence

1. Declare a P0 incident, close risky writes, publish status, acquire the disaster lock, and increment a database-backed disaster epoch.
2. Confirm whether Frankfurt, the primary database, or only the application tier failed. Remove old origins from Cloudflare/load-balancer routing, revoke/deny their database and deployment credentials, and firewall the failed-region write path; an app whose configured epoch is stale fails readiness and every mutation. Do not promote while an unfenced old primary can accept writes.
3. Enable the externally hosted maintenance/read-only response. Confirm the warm DR host already has the exact current signed web/API image digests, configuration schema, and both app asset manifests from the last successful release.
4. Confirm replica lag is below ten minutes and last contact is recent, capture the exact loss window, then promote the Amsterdam replica. If lag is ten minutes or more, require incident-command acknowledgement of likely loss before proceeding; at fifteen minutes or more, the normal RPO gate is failed and payments/exams remain closed.
5. Point the warm DR application at the promoted database. Provision a new regional standby immediately and do not reopen full traffic until database redundancy is healthy.
6. Provision the Terraform-defined Amsterdam Valkey. Until it is ready, permit only the explicitly tested PostgreSQL-fallback reads/session behavior and fail closed for leases, queues, rate limits, new playback/exam/payment writes, or any operation whose coordination safety is uncertain. Rebuild caches/queues from PostgreSQL/outbox after readiness.
7. Activate the incident-only, least-privilege B2 read adapter for finalized objects already present in the manifest; generate short-lived authorized range URLs and keep all uploads/quarantine/payment/assignment writes closed. In parallel hydrate a new private Amsterdam Spaces bucket, verify hashes/manifests, switch the ordinary storage adapter, then revoke the incident B2 read credential. Public immutable assets fail over through the separately mirrored B2/Cloudflare static origin.
8. Run authentication, entitlement, lesson, exam-read, private-file, asset/RSC navigation, and audit-chain smoke checks against the promoted stack.
9. Route Cloudflare to the DR origin and reopen login plus safe read/lesson access first. Keep payments, uploads, exam starts, scheduled jobs, and other mutable paths closed until financial/attempt/object/outbox reconciliation, Valkey readiness, and new database standby all pass.
10. Provision a second DR app and worker from Terraform, deploy the same signed release, run a shortened N-1/load smoke, then reopen only the proven capacity. Record every decision and prepare a controlled return-to-primary plan; never fail back during an active scheduled exam, and fence the DR writer before a later primary is promoted.

### 28.4 Deferred funded cost envelope

The following is a planning estimate dated 13 July 2026. Provider prices, taxes, currency conversion, regional availability, and plan names must be rechecked in official calculators before purchase. SMS use, video storage/delivery, payment fees, domain cost, taxes, and exceptional load-test resources are excluded from the user’s fixed infrastructure budget.

| Item                    | Planning configuration                                                                    |                                   Approximate monthly planning amount |
| ----------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------: |
| Two app nodes           | Two 4 GiB / 2 vCPU droplets                                                               |                                                                   $48 |
| Worker                  | 2 GiB / 1 vCPU droplet                                                                    |                                                                   $12 |
| Functional staging      | 4 GiB / 2 vCPU droplet with enforced service memory ceilings                              |                                                             About $24 |
| Warm DR app             | 2 GiB / 1 vCPU droplet                                                                    |                                                                   $12 |
| Regional load balancer  | One                                                                                       |                                                                   $12 |
| Managed PostgreSQL      | Primary, standby, separate-region read replica at entry HA size                           |                                                         About $90–100 |
| Managed Valkey          | Entry 1 GiB plan                                                                          |                                                             About $15 |
| Spaces                  | Entry private object plan                                                                 |                                                              About $5 |
| Backblaze B2 EU backup  | Base assumes up to 250 GB non-video copy; video-master storage is usage-variable/excluded | About $2, then about $6.95/TB-month plus applicable operations/egress |
| Cloudflare Pro          | One zone                                                                                  |                                                             About $25 |
| Transactional email     | Entry paid Postmark capacity                                                              |                                       About $15, then usage-dependent |
| Better Stack            | Entry paid responder/monitoring capacity                                                  |                      About $34 plus explicitly capped telemetry usage |
| Sentry                  | Single-operator entry tier                                                                |                                         $0 initially, usage-dependent |
| Baseline fixed subtotal | Before excluded variable/burst services                                                   |                                                Approximately $294–307 |

The honest baseline now straddles/exceeds the $150–300 target before tax and usage; do not force staging, monitoring, recovery, or database safety into an artificial ceiling. A successful 2,000-user load test is the only evidence that the entry database/app sizes are sufficient. A third production-sized app node is mandatory during the defined high-stakes 2,000-student exam window and is a prorated burst cost (about $24 if retained for a full month); ephemeral load databases/compute, on-demand DR Valkey/second app/worker, GitHub Actions/GHCR overages, monitoring/log/trace/RUM ingestion, Sentry overage, B2 restore egress/operations, and taxes remain variable/excluded. Likely permanent scale steps are larger app nodes, a larger HA/DR database set, more Valkey memory, and paid telemetry capacity. A comfortable scaled configuration may exceed $400/month; expose that before traffic requires it. Backing up 500 GB–2 TB of original video masters adds roughly $3.50–$14/month at the cited planning storage rate before other charges and remains in the excluded video/content-storage envelope.

Before purchase, record exact plan allowances and hard monthly budget alerts. Initial telemetry guardrails are: redacted application log ingestion at most 10 GB/month with 30-day searchable retention, routine distributed-trace sampling at most 1% outside incidents, frontend performance sampling at most 10%, Sentry error events unsampled but transaction profiles capped by plan, and no session replay. If the selected plans cannot contain those volumes inside the approved amount, lower noncritical sampling/retention or approve budget; never drop security/financial/exam errors or mandatory audit records. CI also records GitHub Actions minutes, artifact/GHCR bytes, and retention, with build artifacts/SBOMs kept only for the stated release-evidence period.

Configure provider spend alerts at 50%, 75%, 90%, and 100% of each monthly allowance. Video delivery is expected to be the largest variable cost and must have its own per-student-hour forecast before promotional traffic begins.

## 29. External Provider Integration Contracts

### 29.0 Lean V1 provider matrix

| Capability                | V1 provider/implementation                  | Launch rule                                                                                     |
| ------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Website/API DNS, TLS, WAF | Cloudflare Free                             | Proxied; origin accepts only Cloudflare for proxied hostnames plus restricted operations access |
| Video delivery            | Hostinger NGINX private HLS                 | `media` record is DNS-only; short signed authorization; no Cloudflare website CDN proxy         |
| Database/cache            | Self-hosted PostgreSQL/Valkey               | Private container network; never exposed publicly                                               |
| Off-host backup           | Cloudflare R2 Standard                      | Encrypted compact backups only; monitor 10 GB-month/operation allowance                         |
| Monitoring                | Better Stack free allowance + local metrics | Synthetic checks and redacted logs; product does not depend on it                               |
| Urgent operations         | Private Telegram bot/chat                   | Redacted alerts only; no student PII/secrets                                                    |
| OTP/SMS/application email | None                                        | No routes, templates, credentials, jobs or promises in V1                                       |

`MediaStorage`, `NotificationChannel`, `OtpProvider`, `ObjectBackup` and telemetry interfaces must exist, but deferred adapters remain disabled and fail closed. The following Bunny/CEQUENS/Postmark/Sentry/B2 material is future funded guidance only unless explicitly superseded above.

Every vendor is wrapped by an internal interface, has separate staging/production credentials, returns normalized internal errors, and records provider request IDs without leaking secrets or PII. Provider failure never changes a completed domain transaction back into an ambiguous state.

Every inbound provider callback uses a dedicated environment/provider endpoint, HTTPS, strict method/content-type/body-size/schema limits, rate controls, and the strongest provider-supported authentication. Verify signature/shared-secret/basic-auth material in constant time and verify timestamp tolerance when the provider supplies one; store a unique provider-event ID or canonical body hash before processing so duplicates/reordering are harmless. A callback without cryptographically verifiable provenance is only a reconciliation hint: fetch the referenced state through the authenticated provider API before any domain change. Persist only the minimal redacted payload, acknowledge only after durable receipt, rotate callback credentials, and test forged, stale, duplicate, reordered, oversized, and cross-environment events. No launch callback can approve a manual payment or bypass a domain state machine.

### 29.1 Cloudflare

- Own production DNS, proxied application records, TLS policy, WAF, Turnstile, rate rules, and origin protection.
- Validate Turnstile server-side; a client token alone never authorizes an action.
- Use targeted challenges for suspicious registration, OTP, password reset, login, and high-rate support/contact behavior. Do not challenge ordinary lesson heartbeats or every API request.
- Respect Egyptian carrier NAT: combine IP, phone/account hash, device cookie, behavior, and velocity rather than blocking a shared IP alone.
- Keep authenticated responses uncached and set private/no-store headers for accounts, payments, exams, questions, assignments, reports, and signed URLs.
- Monitor origin reachability separately from edge reachability.
- Terraform-manage supported DNS/security objects and document any dashboard-only setting in an idempotent runbook.

### 29.2 Deferred — Bunny Stream

- Use separate staging and production libraries and keys.
- Enable MediaCage Basic DRM, block direct file access, allow only exact production/staging domains, disable MP4 fallback, and expose no cast/offline/download control.
- The API creates entitled playback only after account, shared content-scope, release, prerequisite, approved-device, and activity-lease checks. It creates public preview playback only through the explicit section 20.4 branch after public-preview publication, anonymous browser, Origin, and rate checks; preview authorization grants nothing else.
- Generate signed playback/license authorization that expires no later than 90 seconds and record the exact expiry/fence. Entitled renewal requires the still-valid application session and lease ownership; preview renewal requires the same live bounded anonymous preview session and still-public media version. A competing session waits for expiry or confirmed provider revocation. Signing keys never reach either Next.js bundle.
- Entitled playback displays a moving, semi-transparent overlay containing the student’s real display name and academy student ID. Public preview uses only academy branding plus a short random preview-session mark. Randomize position/timing within readable safe areas; never expose a student identity on a preview.
- Track provider library ID, asset ID, source checksum, duration, available resolutions, encode progress/state, poster, upload actor, and publication readiness in PostgreSQL.
- Receive provider callbacks idempotently and poll as a fallback. A video cannot publish until encoding, duration, security settings, and a sampled playback check pass.
- Do not proxy video bytes through the VPS. Adaptive bitrate and data-saver initial quality are player policies.
- Keep the teacher’s original masters outside the serving library. The remaining 500 GB–2 TB is migrated through `media_import_batches/items` after the first 4–6 weeks, each with source checksum/size, target lesson, immutable media version, provider asset, metadata review, resumable attempt history, encode result, and sampled playback; retries reuse lineage and never create an untracked duplicate.
- Screen-recording prevention is not guaranteed. Never claim otherwise in UI or marketing.

Before launch, measure Egyptian playback over Vodafone, Orange, e&, WE, home ADSL, and iPhone/Android browsers. Record startup time, rebuffering, selected quality, token errors, and direct-link sharing behavior. Compare Bunny delivery-network options using real data before choosing the cheaper network for all students.

### 29.3 Deferred — CEQUENS OTP/SMS

- Use the CEQUENS Verification/MFA product as the sole OTP generator and verifier; the academy stores only challenge/check references and local limits, never a parallel OTP hash. Use the SMS product only for approved non-OTP operational messages.
- Normalize numbers to E.164 +20 format before sending; reject impossible or ambiguous numbers rather than guessing.
- Sender identity, production route, templates, spend controls, delivery callbacks, and credentials are day-one onboarding tasks.
- Store provider request ID, purpose, template/version, delivery state, timestamps, and safe error code. Never store or log the OTP itself.
- Do not blindly retry an uncertain send timeout. Reconcile using the provider result when possible or allow a new user-requested send only after cooldown.
- Existing verified accounts may continue password login during an SMS outage. Registration, new device approval, password reset, and phone change wait; OTP is never bypassed.
- Apply phone, account, device, IP, and global spend/velocity limits. Alert on delivery deterioration, unusual resend volume, or spend spikes.
- SMS contains no detailed grades, free-text questions, proof references, full payment details, or reusable authentication links.

### 29.4 Deferred — Postmark application email

- Authenticate the academy domain with SPF and DKIM and publish DMARC in monitoring mode before tightening policy.
- Use a transactional stream for security, Q&A, grading, report-ready, and support messages. Payment status/confirmation is deliberately excluded from email at launch.
- Use a separate broadcast stream for consented announcements/promotions. Never let marketing reputation damage password/security delivery.
- Send only from outbox-driven worker jobs. Domain completion is never rolled back because email is delayed.
- Consume delivery, bounce, complaint, and suppression webhooks idempotently. Stop ordinary mail to hard-bounced/complained addresses and surface a guardian contact-health issue.
- Templates are versioned, Arabic/RTL reviewed, mobile tested, and previewable with synthetic data.
- Do not send payment-status email. The authenticated application is the only payment status/confirmation surface, and it never offers or labels a receipt/tax invoice.
- Monthly-report email volume can exceed an entry plan once the academy reaches thousands of guardians; forecast recipients and purchase sufficient capacity before enabling the feature.

### 29.5 Deferred — paid Sentry telemetry

- Use separate projects or clearly separated environments/releases for academy-web, staff-admin, API, and worker.
- Associate every event with release SHA and environment.
- Disable default PII and scrub names, phones, email, cookies, OTPs, passwords, session/CSRF tokens, payment references/proofs, signed file/video URLs, answer text, question text, and file content.
- Upload source maps privately in CI and do not serve them as public application assets.
- Capture all unhandled errors; sample routine traces conservatively and temporarily increase sampling around scheduled exams through controlled configuration.
- Disable session replay because the platform serves minors. Enabling it later requires a separate privacy/security decision and full masking validation.
- Alert on new regressions, error spikes, failed releases, and exam/payment error signatures.

### 29.6 Better Stack, external status, and Telegram

- Monitor public home, academy login page, staff login page, safe readiness, a synthetic authenticated read, TLS/domain expiry, and the external status page from multiple locations.
- Heartbeats cover logical database backup, object replication, outbox dispatcher, retention job, content-migration batch, and monthly-report scheduler.
- V1 status components: Website, Login/Activation, Lessons/Video, Exams, Payments, Files, and In-app Notifications.
- Send redacted structured logs and sampled traces with release and correlation IDs.
- Route P0/P1 alerts to a private Telegram bot/chat through a secret-validated integration; do not require application email. Better Stack remains outside the VPS so basic uptime alerts survive a Hostinger failure.
- Test trigger, receipt, acknowledgement, escalation, status-page publication, resolution, and postmortem workflow before launch.

### 29.7 Deferred — Backblaze B2 object-backup expansion

- Create the account in EU Central/Amsterdam and protect owner/billing with MFA. Region choice is immutable for that account, so verify it before upload.
- Use separate private buckets or prefixes for logical database dumps, finalized private-object copies, audit roots, and optional original video masters. Names/metadata contain no PII.
- Default encryption at rest is enabled; logical dumps/high-sensitivity bundles are client-side encrypted before upload. Object Lock/retention applies to backup artifacts where deletion policy allows, never as an excuse to retain user data beyond section 23.
- Copier credentials are least-privilege and cannot manage the account/billing. Offline restore credentials and encryption material are unavailable to normal app containers. Key rotation is rehearsed without orphaning old backups.
- Verify object size/checksum and manifest after every copy, alert after ten minutes of finalized-object lag, reconcile daily, and restore a sample monthly. Lifecycle rules implement the exact retention table.
- Original video masters are inventory/continuity assets, not public serving files. Their B2 usage is tracked separately as excluded video storage.

### 29.8 Provider outage behavior

| Failure                     | Student behavior                                                                                            | Operator behavior                                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare partial issue    | Show external status or alternate origin only through an approved incident plan                             | Confirm edge vs origin; never expose an unprotected origin casually                                                                      |
| Hostinger/VPS outage        | Academy and video show the external incident/status response where available                                | Rebuild from pinned Compose/Ansible and restore latest verified R2 database backup; report the known recovery point                      |
| HLS bandwidth/disk pressure | Existing authorized lessons continue while safe; show honest temporary video incident if delivery is fenced | Apply the 8/10/12 TB and 65/75% triggers; migrate through `MediaStorage`; never expose masters or delete entitled content                |
| CEQUENS outage              | Existing verified login works; OTP-dependent operations wait with honest message                            | Queue no fake OTP success; open incident and watch delivery callbacks                                                                    |
| Postmark outage             | Completed operations remain complete; in-app status works; email waits                                      | Retry outbox with backoff; prevent duplicate sends                                                                                       |
| Bunny outage                | PDFs/notes and course outline remain available; video shows service incident                                | Do not reveal source masters; disable new playback if tokens fail                                                                        |
| Valkey outage               | Safe database-backed functions continue or fail closed; no confirmed work is lost                           | Restore service, rebuild caches, replay outbox                                                                                           |
| Worker outage               | Synchronous payment/exam commits remain durable; emails/reports/exports delay                               | Rebuild worker and replay unprocessed outbox                                                                                             |
| Spaces issue                | Existing cached public assets may work; private upload/download pauses safely                               | Restore from backup copy or wait; do not accept proof/submission without durable object                                                  |
| Backblaze issue             | Primary Spaces operation continues; backup status may degrade without affecting confirmed user transactions | Alert on copy lag; do not purge primary objects whose required backup is missing; restore from another verified retention copy if needed |
| PostgreSQL issue            | Enter read-only/maintenance; block payments, exam starts, and mutable actions                               | Fail over/PITR/DR using section 28                                                                                                       |
| Better Stack/Sentry issue   | Product continues                                                                                           | Use provider-native and Cloudflare/DigitalOcean dashboards; no product transaction depends on telemetry                                  |

## 30. Infrastructure as Code, Host Hardening, and Secrets

### 30.0 Lean V1 ownership

V1 uses versioned Docker Compose, Ansible host roles and reviewed operator runbooks. Provision Cloudflare DNS/WAF/Access/R2 and Better Stack via supported APIs/Terraform when practical; otherwise store redacted exported configuration and dual-reviewed screenshots/checklists. Do not create DigitalOcean, Bunny, CEQUENS, Postmark, Sentry or Backblaze resources for launch.

Ansible configures Ubuntu updates, least-privilege deploy user, SSH keys only, disabled password/root login, UFW, fail2ban, automatic security patches with controlled reboot, Docker log rotation, chrony, swap appropriate to the host, filesystem permissions, backup timers, monitoring and recovery access. Public ports are 80/443; SSH is restricted to approved operator IP/VPN where possible. PostgreSQL, Valkey, Docker socket, metrics, admin internals and backup agent are never Internet-exposed. The media hostname terminates TLS at NGINX and exposes only signed HLS routes—never directory listing or source paths.

### 30.0.1 Deferred material below

The multi-cloud Terraform inventory in 30.1 is a future funded target, not a V1 provisioning list.

### 30.1 Deferred funded Terraform ownership

Terraform owns, where provider support is safe and complete:

- DigitalOcean project, VPCs, droplets, tags, firewalls, load balancer, managed PostgreSQL nodes/replicas, Valkey, Spaces, alerts, and DR resources.
- Cloudflare DNS, proxied records, TLS policy, WAF/rate rules, Turnstile sites, Access/Tunnel resources, and maintenance routes.
- Backblaze B2 buckets, lifecycle/Object Lock/default-encryption policy, and least-privilege application keys where a reviewed provider can manage them safely; otherwise use the documented manual-evidence rule below.
- Better Stack monitors, heartbeats, escalation policies, and status-page components.
- Environment-specific outputs that contain no secret values.

Use separate remote state/credentials for staging, ephemeral load, production, and DR. The `load` stack owns its own short-lived project/VPC/DNS/database/object prefixes and never imports a staging/production resource. Every load resource carries owner, release, purpose, created-at, and hard-expiry/TTL tags; apply requires an approved cost ceiling and destroy deadline. A finally-style workflow attempts destroy after every run, a separate expiry monitor pages on leaked resources, and completion evidence proves resources, public DNS, credentials, and sensitive state outputs are removed while retaining only sanitized plans/results. Pin Terraform and provider versions in the lockfile. Every infrastructure PR runs format, validate, security scan, and plan. Production apply is manual from a reviewed main commit. Nightly drift detection alerts but never auto-applies. A destructive plan requires typed confirmation, a current backup/restore proof, and impact review.

Provider objects that cannot be safely automated may be configured manually only with:

- A named owner.
- An exact runbook.
- Screenshots or exported configuration evidence.
- A periodic drift check.
- No secret copied into the document or repository.

### 30.2 Host baseline

- Ubuntu 24.04 LTS with unattended security updates; reboot in announced windows except urgent exploited vulnerabilities.
- Non-root operations account; root password login disabled.
- Administration only through MFA-protected short-lived access.
- DigitalOcean firewall and host UFW defense in depth.
- Docker/Compose installed from official sources and pinned by Ansible.
- NGINX, Node application, and helper images pinned by digest.
- No services bind publicly unless explicitly required.
- Resource limits and restart policies are explicit.
- Local logs are bounded and rotated; disk warning at 70%, critical at 85%.
- Image/container cleanup is scheduled and never removes the running or last known-good rollback image.
- System time synchronization is monitored because OTPs, exams, signed URLs, and audit ordering depend on it.

### 30.3 Secret model

Use SOPS-encrypted per-environment configuration committed to the private repository, or an equivalent audited secret manager. The decryption key exists only in the relevant protected GitHub Environment and two offline recovery copies.

Rules:

- Secrets never enter image layers, Docker build arguments, Terraform output, source maps, CI artifacts, test snapshots, or logs.
- CI decrypts only inside the protected deploy job. A root-only host deploy helper creates a per-service runtime directory on tmpfs (`0710 root:<service-gid>`), atomically writes each required secret as `0440 root:<service-gid>`, and read-only bind-mounts only that directory at `/run/secrets` into the fixed non-root container UID that belongs solely to that service GID. Secrets never enter Compose environment interpolation, image layers, `docker inspect`, or another service mount; rotation uses write/fsync/chown/rename followed by bounded reload/restart, then deletes all deploy-temporary plaintext.
- Staging and production use different credentials, signing keys, encryption keys, buckets, libraries, sender settings, databases, and webhook secrets.
- Use separate keys for PII encryption, lookup HMAC, password pepper where used, session token hashing, TOTP encryption, audit chaining, Bunny signing, CSRF/session, and each provider.
- Encrypted fields contain key version so rotation is possible.
- Rotate privileged deployment/provider tokens quarterly and immediately after exposure or staff departure. Rehearse one rotation before launch.
- MFA is mandatory on GitHub, registrar, DigitalOcean, Cloudflare, Bunny, CEQUENS, Postmark, Sentry, Better Stack, and the backup-object provider.
- Store recovery codes offline. Create a sealed break-glass packet for a named trusted backup person; it contains recovery locations and instructions, not routine plaintext passwords.

### 30.4 Database roles

Create independent roles:

| Role           | Rights                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------- |
| migration      | Schema migration during protected deployment only                                           |
| api            | Application tables needed by synchronous requests; no schema change; no audit update/delete |
| worker         | Job/outbox and domain tables needed by consumers; no schema change; no audit update/delete  |
| reporting      | Read-only approved views, never unrestricted direct PII export                              |
| backup         | Minimum rights for logical dump                                                             |
| audit verifier | Read-only audit-chain verification                                                          |

The runtime must not connect as PostgreSQL owner/superuser. Row and statement timeouts are chosen per workload, and long analytical queries use read models/replica where safe.

## 31. CI/CD and Release Engineering

### 31.1 Branch and review policy

- Private GitHub repository.
- Protected main branch; no force push or direct unreviewed production changes.
- Short-lived feature branches and pull requests.
- Require green CI and resolved review for security/domain/migration changes.
- CODEOWNERS or equivalent assigns review for identity, payments, exams, database migrations, infrastructure, and security-sensitive files.
- Production GitHub Environment requires manual owner approval and stores deployment-only secrets.
- Every release records SHA, image digests, migration IDs, feature flags, tests, approvers, known defects/waivers, and timestamp.

### 31.2 Pull-request pipeline

Every pull request runs:

1. Frozen pnpm installation and lockfile integrity.
2. Formatting check and lint without rewriting.
3. Strict type checking.
4. Prisma schema validation and migration lint/review.
5. Unit/domain tests with coverage.
6. PostgreSQL/Valkey integration tests in disposable containers.
7. API contract and full authorization-matrix tests.
8. Critical Playwright journeys in Arabic RTL and both themes where relevant.
9. Production builds for academy-web, staff-admin, API, and worker.
10. OpenAPI regeneration and generated-client diff check.
11. Secret scanning.
12. Static analysis.
13. Dependency and license scan.
14. Container/filesystem vulnerability scan.
15. Dockerfile and Terraform security scan.
16. SBOM generation.

Fail on newly introduced critical/high vulnerabilities unless a qualified reviewer documents an exception, compensating control, owner, and near-term expiry. P0 auth, authorization, payment, exam, file, secret, or dependency vulnerabilities are not waiver candidates.

### 31.3 Image supply chain

- Build each deployable image once after CI.
- Tag with the full Git SHA and push to private GHCR.
- Produce SBOM and provenance.
- Sign images using GitHub OIDC/keyless signing or an equivalent protected process.
- Production deploy verifies expected digest/signature.
- Retain the current and at least three prior known-good release images.
- Never rebuild a released SHA to create different bytes.

### 31.4 Staging and production deployment

GitHub Actions uses one non-cancelling production concurrency group, so a second workflow queues rather than interleaves. Independently, a single-row `deployment_releases` control record is acquired by compare-and-swap from `IDLE` to `DEPLOYING(releaseSha, workflowId, actor, leaseExpiry)` before any production asset, migration, host, flag, or DR mutation. Only that workflow may advance steps; completion/rollback clears it. Expired-lock recovery requires recent owner TOTP, proof that no deploy is running, reason, and audit. The database migration advisory lock is additional protection, not the release lock.

1. Merge approved PR into main.
2. Build once, scan, sign, and publish immutable images plus distinct academy/staff deployment manifests.
3. Deploy automatically to staging.
4. Apply migrations to staging; run smoke, critical E2E, vendor sandbox, accessibility, migration compatibility, Server-Action-prohibition, and version-skew tests.
5. Owner starts a manual production workflow with exact SHA and confirmation; workflow acquires both concurrency/CAS controls.
6. Check the exam/deployment-freeze calendar, current backup/object-copy/replica status, active disaster epoch, and absence of unresolved P0 financial/attempt consistency incidents.
7. Record the latest recoverable database point and run migration preflight.
8. Upload immutable Next.js/static assets for the exact per-app deployment IDs to the shared asset host and static DR origin; verify manifest checksums and representative chunks through both while old-release assets remain present.
9. Apply backward-compatible migrations once under a database advisory lock.
10. Remove app node A from the load balancer, deploy, wait for liveness/readiness, run HTML/RSC-to-correct-shared-chunk smoke, return it.
11. Repeat for app node B. Old and new HTML/RSC responses may coexist, each declares its deployment ID, and both complete asset sets resolve.
12. Drain worker consumers without discarding outbox work, deploy worker, and resume.
13. Deploy the exact same release SHA/image digests/configuration schema to the warm DR host, keep it off user routing, and prove read-only readiness against the replica plus both asset manifests. A failed/stale DR readiness check blocks release success.
14. Run production smoke and synthetic reads from a fresh browser with an empty service-worker/CDN cache, then a long-lived-browser test that started on the prior release and covers public/RSC navigation, student navigation, active-exam save state, deferred service-worker activation, A/B coexistence, and rollback. The test must show safe full navigation on deployment mismatch without losing confirmed work.
15. Observe error/latency/resource/queue/financial/exam/replica/DR-readiness dashboards for at least 30 minutes.
16. Compare-and-swap the release record to `SUCCEEDED` and clear the deploy lease, or roll back production and DR application images together; retain prior images and both app asset prefixes throughout the rollback window.

No normal deployment occurs from two hours before a scheduled exam until thirty minutes after it ends. P0 rollback/fix is the exception and must be incident-controlled.

### 31.5 Safe database migration pattern

- Expand with additive/nullable fields and compatible indexes.
- Deploy code that handles old and new shapes.
- Backfill in bounded asynchronous batches.
- Add validation/constraints only after backfill proof.
- Contract/remove old fields only in a later release.
- Create large indexes concurrently.
- Never automatically reverse a production migration.
- Application rollback must remain compatible with the expanded schema; otherwise the migration is not launch-safe.
- Test every migration on a production-volume synthetic copy and include runtime/lock evidence.

### 31.6 Rollback

Application rollback:

- Disable the triggering optional flag or write path.
- Put affected functions into maintenance/read-only mode.
- Restore the prior signed image digest.
- Restore the same prior digest/configuration on the warm DR host and verify its read-only compatibility.
- Keep additive schema.
- Run auth, entitlement, payment read, lesson, exam read, and audit smoke tests.
- Publish status updates and reconcile any in-flight jobs.

Database restoration is reserved for confirmed corruption or destructive operator error, not ordinary application regressions. Never PITR casually because it can remove legitimate payments/exam work created after the target time.

## 32. Observability, SLOs, Alerts, and Incident Policy

### 32.1 Service objectives

These are internal engineering objectives, not promises to students unless a later contract explicitly makes them an SLA.

| Objective                                                  |                                                                                       Target |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------: |
| Core monthly availability, excluding announced maintenance |                                                                                        99.9% |
| Ordinary API read p95 under accepted load                  |                                                                             300 ms or better |
| Ordinary API write p95 under accepted load                 |                                                                             500 ms or better |
| Durable exam-answer autosave p95                           |                                                                             750 ms or better |
| Final exam submission p95                                  |                                                                          2 seconds or better |
| Steady-state API 5xx                                       |                                                                                   Under 0.1% |
| Payment-to-entitlement inconsistency                       |                                                                                         Zero |
| Lost/duplicated/cross-student acknowledged answers         |                                                                                         Zero |
| Normal primary/Frankfurt-region recovery                   | RTO under 1 hour, RPO at most 15 minutes; off-provider catastrophe exception is section 28.2 |

Availability SLI is the proportion of valid user/synthetic requests to the public, login, lesson-read, and assessment-save entry points that complete without 5xx/timeout inside their route SLO, measured at Cloudflare and origin over a rolling 28 days. Exclude only preannounced maintenance windows recorded before they begin; never exclude provider incidents, overload, bad deploys, or partial-region failures after the fact. The 99.9% objective yields a 0.1% error budget, and the dashboard shows consumed/remaining minutes plus multi-window burn.

### 32.2 Correlation and redaction

Every HTTP request, provider call, outbox event, worker job, and export carries a correlation/trace ID and immutable release SHA. Logs may contain pseudonymous account ID, organization/branch/cohort ID, course/item/order/attempt/job IDs, route, result code, duration, provider request ID, and Cloudflare Ray ID.

Logs and telemetry must never contain:

- Raw name, phone, email, OTP, password, TOTP/recovery code.
- Session, CSRF, provider, signing, or encryption secrets.
- Full payment reference, proof image/PDF, destination secret, or signed URL.
- Exam answer text/choice before safe aggregation.
- Private question, subjective response, staff internal note, guardian message, or file content.
- Bunny token or source/master location.

Redaction occurs before data leaves the process. Do not rely only on the downstream provider’s scrubber.

### 32.3 Dashboards

Create role-appropriate operational dashboards for:

- Edge/app: request rate, p50/p95/p99, status codes, active/deploying releases and deployment lock, per-app deployment IDs, cache hit, origin/DR readiness, availability SLI and error-budget burn.
- Frontend experience: Core Web Vitals by route/release/coarse device/network, JavaScript budget, route/load failures, service-worker update/errors, and sensitive-cache exclusion probes.
- Identity: registration funnel, OTP send/verify, login outcomes, password recovery, new-device approvals, device-limit blocks, rate limiting.
- Commerce: orders by state, proof queue age, approval/rejection/reversal/refund counts, ledger reconciliation, entitlement mismatch count, coupon/upgrade reservations.
- Learning/video: playback starts, token failures, provider/player errors, unique-watch heartbeat lag, completion rate, data-saver use.
- Assessments: starts, active attempts, autosave p95/failures, submission p95/failures, timeout queue, result-release queue, integrity-event volume.
- Assignments/Q&A/practice/reports when enabled: queue age, grading SLA, moderation backlog, session failures, report generation/delivery.
- Database: CPU, memory, disk, connections, pool wait, locks, deadlocks, slow queries, replication lag, PITR/backup status.
- Valkey: memory, connections, evictions, latency, key/lease anomalies.
- Worker: outbox oldest age, per-queue depth, retries, dead letters, scheduled-job heartbeat.
- Files: quarantine/scan failures, backup-copy lag, signed-link failures, object growth.
- Providers and spend: CEQUENS success/cost, Postmark delivery/bounce, Bunny delivery/storage, Sentry event quota, infrastructure budget.
- Product aggregates: privacy-minimized registration/claim/checkout completion, lesson completion, assessment save/submit reliability, support creation, and enabled-feature adoption; no direct student identity or free text.

### 32.4 Severity and alert thresholds

| Signal                                                                                                                      | Severity and action                               |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Two-location availability failure for two consecutive checks                                                                | P0; page immediately                              |
| Confirmed authorization or private-data isolation breach                                                                    | P0; close affected paths                          |
| Lost exam answer or duplicate/cross-student attempt state                                                                   | P0; block exam starts/submission path as required |
| Approved payment without correct ledger/entitlement, or entitlement without valid source                                    | P0; close financial writes                        |
| DR replica lag >=10 minutes for 2 minutes, disconnected/unknown for 5 minutes, or latest recoverable point age >=15 minutes | P0; close risky writes and page                   |
| DR replica lag >=5 minutes for 5 minutes or latest recoverable point age >=10 minutes                                       | P1; investigate before RPO is threatened          |
| Nightly B2 logical dump is >30 hours old, managed PITR unhealthy, or required restore verification failed                   | P0                                                |
| Nightly B2 logical dump is >26 hours old or monthly restore evidence is overdue                                             | P1                                                |
| 5xx above 5% for 2 minutes                                                                                                  | P0                                                |
| Availability error budget burns >=14.4x over 1 hour and >=14.4x over confirming 5 minutes                                   | P0                                                |
| Availability error budget burns >=6x over 6 hours and >=6x over confirming 30 minutes                                       | P1                                                |
| 5xx above 0.3% for 10 minutes, above 1% for 5 minutes, or p95 above 1 second for 10 minutes                                 | P1                                                |
| Database CPU above 80%, connection usage above 75%, or disk above 75% for 10 minutes                                        | P1                                                |
| Critical job/outbox event older than 2 minutes                                                                              | P1                                                |
| Finalized object backup-copy lag above 10 minutes                                                                           | P1                                                |
| OTP delivery success below 90% over a meaningful sample                                                                     | P1                                                |
| Manual payment queue passes 12-hour SLA                                                                                     | P1 business/operations alert                      |
| Assignment grading passes 48-hour SLA                                                                                       | P1 academic operations alert                      |
| Domain/TLS expiration under 30 days                                                                                         | P1                                                |
| Spend projection exceeds configured allowance                                                                               | P1 before hard limit                              |

P0 goes to Telegram and email at all hours. Technical P0 coverage is distinct from student support: a named primary or trained backup acknowledges within five minutes during launch/scheduled exams and within fifteen minutes at every other hour, 24/7, to make the one-hour RTO credible. If no backup/on-call path is staffed, the release cannot claim or pass that RTO. Human student support remains 10:00–22:00. A user-visible incident lasting more than five minutes appears on the external status page and receives an update at least every twenty minutes. Complete P0/P1 postmortems within forty-eight hours.

### 32.5 Maintenance

- Use low-traffic Cairo-time windows and announce them in-app/email ahead of time.
- Block new exam starts before any risky migration or dependency maintenance.
- Preserve read-only access to already safe content when feasible.
- Never claim 24/7 human support; human support is 10:00–22:00 Cairo daily.
- Automated monitoring remains 24/7.
- For each fixed-window exam, the technical owner is actively on call from sixty minutes before opening through thirty minutes after closing, and priority support is staffed.

## 33. Quality Strategy, Capacity Tests, and Independent Security Review

### 33.1 Test layers

| Layer                  | Required focus                                                                                                                     |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Pure domain unit tests | Permissions, pricing, coupons, upgrade credit, entitlement transitions, timer/deadline math, scoring, progress, report aggregation |
| Database/integration   | Real PostgreSQL/Valkey via Testcontainers, constraints, row locking, concurrent decisions, outbox replay, migrations               |
| API contract           | Error envelope, pagination, idempotency, object authorization, rate limiting, OpenAPI compatibility                                |
| Browser E2E            | Public, registration/claim, guardian, manual payment, lesson, exam, support, and staff journeys                                    |
| Accessibility/visual   | Arabic RTL, keyboard, focus, contrast, zoom, mixed-direction fields, light/dark, responsive snapshots                              |
| Provider contract      | Sandbox and deterministic failure mocks for Cloudflare, CEQUENS, Postmark, Bunny, Spaces, Sentry/Better Stack webhooks             |
| Operational            | Deploy/rollback, failed migration preflight, backup restore, DR promotion, alert route, maintenance/read-only                      |
| Performance            | k6 load, spike, soak, N-1, and exam profiles                                                                                       |

Minimum automated coverage is 90% branch coverage for pure domain, auth/authorization, commerce/entitlement, and assessment modules, and 80% line coverage overall. Percentages never substitute for the explicit critical scenarios in sections 14 and 24.

### 33.2 Browser and device matrix

P0 manual/E2E coverage:

- Current and previous supported Chrome on Android, including a low/mid-range device.
- Current Safari on iPhone and iPad.
- Current Chrome, Edge, Firefox, and Safari desktop within the Next.js supported browser baseline.
- 320, 360, 390, 768, 1024, and 1440 CSS-pixel widths.
- Touch, keyboard-only, screen-reader smoke, 200% zoom, reduced motion, light/dark, data-saver, mixed Arabic/English copy/paste.
- Home ADSL and major Egyptian mobile networks where testers can provide them.

Unsupported/old browsers receive an honest upgrade message and never silently corrupt an exam or payment.

### 33.3 Production-equivalent load data

#### Lean V1 load profile (authoritative)

Seed 3,000 synthetic student accounts plus realistic guardians, enrollments, entitlements, four weeks of content, progress, orders and assessments on a disposable KVM 4-equivalent rehearsal or an isolated test window. Never use real PII or send external messages. Preserve scripts, release SHA, exact host plan, Compose limits, database query plans, bandwidth graphs, CPU steal/load, memory, disk latency, NGINX connections, Postgres connections/locks and result files.

Execute in ascending stages and stop before host instability:

1. Static/authenticated learning: 100, then 200, then 300 concurrent mixed users for 30 minutes excluding video bytes; include login, catalog, entitlement checks, progress heartbeat, Q&A reads and ordinary dashboards.
2. Video origin: 50, 100, 150, then 250 simultaneous real HLS sessions for 30 minutes, with a realistic 720p/480p mix, range requests, token renewal, seeking and 15% start/stop churn. Load generators must actually consume bytes and sit outside the VPS. Record Mbps and monthly-transfer projection.
3. Combined peak: the highest proven safe video stage plus 100 mixed API users for 30 minutes; verify video cannot starve login, payment, exam or heartbeat paths.
4. Exam rehearsal: 150 students open a fixed-window assessment in 60 seconds, autosave every 20 seconds with jitter and duplicate retries, then submit within a 60-second window. Increase only after this passes and only if real scheduling needs it.
5. Soak: 100 mixed users plus 50 video sessions for four hours.
6. Faults: restart API/worker, remove Valkey, fill a disposable disk toward warning thresholds, expire HLS signatures and restore PostgreSQL from R2; prove fail-closed authorization and no lost acknowledged answer/payment transition.

V1 acceptance: zero cross-account authorization leak, lost acknowledged answer, duplicate terminal transition or payment/entitlement inconsistency; 5xx below 0.1% in steady state; ordinary p95 API reads ≤500 ms, writes ≤750 ms, autosave ≤1 s and final submission ≤2.5 s; sustained host CPU below 70% with peak below 85%, memory below 80%, disk wait without sustained saturation, Postgres connections below 70%, outbox age below two minutes, and at least 25% disk free. The **official launch concurrency is the highest combined stage that passes with 30% resource headroom**, not 3,000 and not a number inferred from monthly students.

Re-run after significant dependency/schema changes and review weekly for the first month using actual peak concurrency, average rendition bitrate, rebuffer rate and transfer. Upgrade/migrate before breaching the triggers in 27.0.1.

#### Deferred funded scale-test profile below

The former 25,000-account/2,000-concurrent/N-1 scenarios below apply only after multi-node funded infrastructure is approved. They are not V1 blockers or claims.

Provision the Terraform-defined ephemeral load/rehearsal environment at production app/worker/database/Valkey sizes, then seed it with:

- 25,000 synthetic student accounts and realistic guardians.
- Academic year, cohort, branch, courses, the first 4–6 weeks of lessons, entitlements, progress, orders, notifications, and audit history.
- At least 100,000 published question records/versions and realistic assessment blueprints.
- Realistic attempt-answer counts, practice filters, reports, and staff queues.
- No real PII and no real provider sends; vendor adapters are sandboxed/deterministic.

Run load from more than one generator outside the target VPC so the generator is not the bottleneck. Rehearse production-volume migrations there before load. Preserve k6 scripts, result files, release SHA, exact Terraform plan/sizes, infrastructure graphs, database query plans, and final capacity decision; then destroy the stack and prove no synthetic credentials/public DNS remain.

### 33.4 Deferred funded k6 scenarios

1. Steady learning: 2,000 concurrent users for 30 minutes, including navigation/entitlement checks and progress heartbeat every 30 seconds.
2. Login spike: 500 login attempts in one minute with OTP provider behavior mocked after the adapter.
3. Exam opening: 2,000 students start the same fixed-window assessment inside 60 seconds.
4. Exam work: 2,000 active attempts autosave around every 20 seconds, including retry/idempotency.
5. Exam close: 2,000 final submissions in 60 seconds with deliberate duplicate client retries and timeout races.
6. Payment review: concurrent order creation, duplicate proof finalization, approval/rejection races, refund/reversal idempotency, and upgrade-credit contention.
7. Spike: zero to 2,000 active users in 30 seconds.
8. Soak: 1,000 active users for four hours.
9. N-1 baseline: while the full 2,000-user mixed profile is steady, remove one of the two application nodes and hold the profile on the single remaining node for at least 15 minutes.
10. Dependency degradation: restart worker, remove Valkey, delay Bunny/CEQUENS/Postmark/Spaces adapters, and verify safe behavior.
11. Scheduled-exam profile: add a third app node, open/start/work/submit 2,000 fixed-window attempts, then remove any one serving node; the remaining two nodes sustain the profile through at least 15 minutes and the submission burst.

Video bytes flow from Bunny and are not generated through the VPS. Separate real-device media testing measures playback startup, rebuffering, adaptive quality, resume, watermark, domain restriction, token renewal, and failed link sharing.

### 33.5 Deferred funded load acceptance

- Zero authorization leak, lost answer, duplicate terminal transition, or payment/entitlement inconsistency.
- Steady HTTP failure under 0.5%; 5xx under 0.1%.
- p95 read at most 300 ms, ordinary write 500 ms, autosave 750 ms, final submit 2 seconds.
- p99 dynamic API under 1.5 seconds except final submission.
- Application CPU average below 70%, peak below 85%, memory below 80%.
- Database CPU below 70%, connection usage below 70%, no sustained lock queue/deadlock pattern.
- Critical outbox/queue age below two minutes.
- Two normal production app nodes sustain the expected profile, and the single-node N-1 phase holds the same 2,000-user mix for 15 minutes within the listed correctness/error/latency/resource gates. If either fails, resize each node or make three nodes the permanent baseline and rerun the exact failure profile; do not relabel a reduced workload as N-1 proof.
- Every defined high-stakes/fixed-window exam profile provisions a third tested node at least 60 minutes before opening, then proves that loss of any one leaves the independently accepted two-node capacity through submission.
- Public static cache hit at least 80% where cacheable; authenticated/dynamic responses show zero unintended shared cache hits.

Scaling triggers:

- Add/retain an app node when peak p95 latency breaches SLO with healthy dependencies or app CPU exceeds 65% for fifteen minutes.
- Resize PostgreSQL when CPU exceeds 60% at peak, connection usage exceeds 70%, cache hit degrades, or optimized-query latency remains high.
- Resize Valkey at 70% memory or any sustained eviction of required coordination keys.
- Add worker capacity when oldest critical work exceeds one minute at normal load.
- Provision the exam node at least sixty minutes before a scheduled high-stakes exam and remove it only after the observation window.

### 33.6 Real-user pilot

Before public launch, run 30–50 students plus guardians and every staff role through the access-restricted production deployment. This is the only prelaunch environment permitted to hold their real accounts/PII; staging and load tests remain synthetic. Include:

- Online registration and guardian activation.
- Offline roster claim.
- Manual payment submission and real assistant review using controlled low-value/test arrangements.
- Video/data-saver/PDF behavior.
- Quiz and a fixed-window exam with simulated disconnect/reconnect.
- Device conflict and support recovery.
- Payment rejection/resubmission.
- Priority exam support.
- At least eight students in moderated UX sessions and three guardians including one with multiple children.

Collect device/browser/network, task completion, comprehension, support burden, player startup/rebuffering, error IDs, and qualitative feedback. No unresolved critical journey, privacy, content-correctness, accessibility-interface, or data-loss issue remains.

### 33.7 Independent targeted security review

Book the reviewer immediately and provide a release-candidate staging environment no later than 25 July. Map automated and manual checks to OWASP ASVS Level 2 and the OWASP API Top 10.

Review scope:

- Registration, OTP, password reset, phone change, sessions, TOTP, and device limits.
- Student/guardian/staff object and role authorization across every endpoint/export.
- Minors’ data, guardian relationship changes, analytics/redaction.
- Manual-payment proof, review idempotency, ledger, entitlement, refund/reversal, and upgrade credit.
- Assessment start, snapshot, timer, autosave, reconnect, submission, result release, and attempt reset.
- Subjective/Q&A/coupon/report/practice modules if enabled.
- Upload MIME/malware, signed URLs, view-only/download, Bunny signing/source leakage.
- CSRF, CORS, XSS, injection, SSRF, open redirect, mass assignment, rate-limit/OTP abuse.
- Cloudflare/origin bypass, database/network permissions, secrets, CI artifacts, source maps, logs/telemetry.

All critical/high findings affecting P0 are fixed and independently retested before transactional public launch. Medium findings have a written mitigation, owner, due date, and owner waiver. Low findings enter a tracked backlog. A deadline alone is never mitigation.

### 33.8 Accessibility gate

The application UI and non-video content must pass:

- Automated axe checks with zero serious/critical unresolved issues.
- Complete keyboard operation and visible focus.
- Arabic screen-reader smoke tests.
- 200% zoom, text-spacing override, reflow, reduced motion, and contrast.
- Mixed RTL/LTR phone, OTP, student ID, price, and payment-reference behavior.

Because launch video has no captions, do not publish a whole-product WCAG 2.2 AA conformance claim. Track captions/transcripts as the explicit remediation before making such a claim.

## 34. July 13–31 Delivery Plan and Rollout

### 34.1 Operating rule

Every date is a working day. Engineering, vendor onboarding, domain/brand/content preparation, security-review booking, and content migration run in parallel. There is no schedule buffer. Freeze P0 behavior after 23 July; after that date only defects, security, performance, content correctness, operations, and independently gated optional modules may change.

Antigravity must keep an evidence board with one row per deliverable: owner, status, pull request/SHA, automated evidence, manual evidence, unresolved defects, and release class. “Implemented” without evidence means incomplete.

### 34.2 Critical path

| Date      | Required outcome                                                                                                                                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 13–14 Jul | Freeze Lean V1/P0; create private repo; purchase/select domain and Hostinger KVM 4; create Cloudflare, Better Stack and private Telegram alert resources; inventory four weeks of content; record renewal/free-tier limits; book security reviewer                           |
| 14 Jul    | pnpm monorepo, strict config, local Compose, CI skeleton, Ansible baseline, Prisma schema/migrations, observability/redaction, design tokens and app shells                                                                                                                  |
| 15 Jul    | Staging reachable; organization/academic model, pre-created identities/activation credentials, roles, guardian model, staff Cloudflare Access/TOTP, synthetic seeds; R2 backup smoke                                                                                         |
| 16 Jul    | Activation, phone/password login/logout, authenticated password change, staff-issued temporary reset, contact correction, offline roster activation, sessions, two-device rules, one-activity lease, authorization tests; prove there are no register/OTP/forgot/email paths |
| 17 Jul    | Catalog/product/course/chapter/unit/lesson administration, scheduler/prerequisites, private upload/quarantine/scan, source manifest, first content ingestion                                                                                                                 |
| 18 Jul    | Orders, upgrade quote/credit, manual InstaPay/wallet instructions, proof/reference upload, finance queue, approve/reject/reverse/refund, ledger, entitlement, audit/idempotency                                                                                              |
| 19 Jul    | Workstation FFmpeg manifest/pipeline; private 720p/480p HLS upload/reconciliation; NGINX signed playback; moving name/student-ID watermark; heartbeat/watched ranges/resume/90% completion; in-app notification/outbox                                                       |
| 20 Jul    | Student/guardian dashboards, course outline, lesson/PDF view, payment history/confirmation, progress, notifications, support tickets and WhatsApp link                                                                                                                       |
| 21 Jul    | Single-answer MCQ bank/import, passage/image groups, blueprint, quiz/exam authoring, deterministic attempts, server timer, durable autosave/reconnect, submit/grade/release                                                                                                  |
| 22 Jul    | Minimum complete staff operations: students/guardians/devices, roster, content, payments, attempts, support, announcements, audit/settings; all P0 permission matrices                                                                                                       |
| 23 Jul    | P0 feature complete and API/schema freeze; production Compose/Ansible, R2 encrypted backups, monitoring, feature flags, kill switches, legal-risk wording, and first content set operational                                                                                 |
| 24 Jul    | Full integration/E2E/accessibility/security sweep; migrations on production-volume synthetic data; content and Arabic RTL review; added targets default off                                                                                                                  |
| 25 Jul    | Seed 3,000 synthetic accounts on isolated KVM 4-equivalent rehearsal; run section 33 load test 1; timed R2 restore/clean-host rebuild; bottleneck fixes; independent reviewer receives RC staging                                                                            |
| 26 Jul    | RC1 deployed to KVM 4 behind the server-owned pilot allowlist; Cloudflare website/API proxy, DNS-only media TLS, R2 backup, Better Stack and Telegram verified; controlled payments and protected HLS end to end                                                             |
| 27 Jul    | 30–50-person student/guardian/staff pilot begins in restricted production on real devices/networks; targeted security review continues; support and telemetry observed; no real PII enters staging/load environments                                                         |
| 28 Jul    | Pilot fixes; section 33 combined/video/soak/fixed-exam load test 2; security fixes/retest; no feature expansion                                                                                                                                                              |
| 29 Jul    | RC2 final UAT, runbook rehearsal, known-defect/waiver register, teacher content/business signoff, technical owner signoff                                                                                                                                                    |
| 30 Jul    | Final RC controlled single-host deploy while production remains pilot-restricted; smoke plus restore/alert/rollback evidence; bandwidth/disk dashboards; DNS/status check; final content/payment-destination review                                                          |
| 31 Jul    | Staged public launch beginning 10:00 Cairo with technical and support coverage through 22:00; twenty-four-hour release freeze except verified P0 rollback/fix                                                                                                                |

This table is an aggressive target, not a guarantee. If external accounts, sender approval, content, security review, load capacity, or the real pilot cannot finish, the corresponding public capability remains closed.

### 34.3 Added July target gates

Each target is server-flagged, default false in production, and accepted independently:

| Target                   | Minimum enablement proof                                                                                                                                                |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subjective assignments   | Typed/image/PDF submit; scan; attempts/due date; grader authorization/claim; rubric/comments/annotation; return/resubmit; 48-hour SLA; notifications; full audit/E2E    |
| Published anonymized FAQ | Private question isolation; academic answer; separate moderation; identity/attachment removal; entitled-course visibility; search/withdrawal; abuse/security tests      |
| Coupons                  | Fixed/% math; product/student scope; validity; total/per-student limits; concurrency; immutable order snapshot; refund/upgrade interaction; usage reporting             |
| Monthly guardian reports | Correct Cairo-month snapshot; authoritative metrics; unreleased-result exclusion; active guardian recheck; authenticated in-app portal only; no SMS/email jobs          |
| Standalone practice bank | Filters; deterministic resumable sessions; MCQ-only scoring; explanations; mapped lesson recommendations; no official-grade effect; production-volume query performance |

If a target fails, it is absent—not marked beta or coming soon. Its shared code must not destabilize P0.

### 34.4 Staged production launch

Every transition writes a signed go/no-go worksheet with evidence timestamp, release/deployment IDs, flag before/after, sample counts, dashboard links, open incidents, technical-owner decision, and Mr. Bahrawy's approval for commerce/promotion. “Healthy” without the thresholds below is not approval. If a minimum sample is unavailable, delay rather than infer success from zero traffic.

1. On 30 July, keep production restricted by the server-side pilot allowlist. Exercise every critical integration and at least three controlled payment histories covering approve, reject/resubmit, and reversal/refund/ledger-entitlement reconciliation.
2. At 10:00 Cairo on 31 July, verify no open P0/P1, no deployment lock, all critical synthetics green for 30 minutes, latest encrypted R2 backup/restore evidence current, disk below 65%, projected transfer below action threshold, outbox age below 30 seconds, database CPU/connections below 60%, and zero known auth/answer/payment/ledger/entitlement inconsistency. Technical owner may enable pilot access; observe thirty minutes.
3. At 10:30, invite/roster activation may open only after at least 20 successful pilot activation/recovery journeys, zero duplicate account/guardian/device result, identity-route 5xx below 0.5%, and proof that `/register`, OTP, forgot-password and application email/SMS are absent. Public self-registration remains closed.
4. At 11:00, manual order/proof submission may open only when the three controlled histories reconcile, scan/object services are green, finance coverage is logged through 22:00, payment queue has no unexplained overdue/exception, and zero proof/ledger/upgrade/entitlement anomaly exists. Technical owner and Mr. Bahrawy approve.
5. At 12:00, promotional traffic may begin only after the staged window contains at least 1,000 dynamic requests, 5xx below 0.5%, p95 within the V1 section 33 gates, host/database headroom is at least 30%, outbox age is below one minute, at least 20 protected HLS starts have ≥95% application/player-start success excluding confirmed user-offline exits, transfer projection is safe, and every support queue has a named responder. Any correctness/privacy defect is a no-go regardless of percentages.
6. Enable accepted added modules one at a time, separated by at least thirty minutes and their own evidence snapshot. There is no obligation to enable any added module on launch day.
7. Keep a twenty-four-hour deployment freeze except rollback or verified P0 correction.

Immediate kill-switch/rollback triggers:

- Cross-account authorization or private-data incident.
- Lost/duplicated exam answer or attempt.
- Payment/ledger/entitlement inconsistency.
- Active secret exposure or exploitation evidence.
- 5xx above 5% for two minutes.
- Sustained database saturation above the tested safe limit.
- Uncontrolled critical queue/outbox growth.
- OTP abuse/spend or provider behavior outside safe limits.

Rollback disables optional flags and the affected write path, enters maintenance/read-only mode, restores the previous signed image, verifies schema compatibility, runs critical smoke/reconciliation, and updates status. It does not casually restore the database.

### 34.5 Release signoff

The technical owner and Mr. Bahrawy both approve the final release record.

Technical owner signs:

- Release SHA/images/migrations.
- Security, authorization, load, backup/restore, DR, monitoring, and runbooks.
- Vendor and DNS readiness.
- Known defects and any permitted waiver.

Mr. Bahrawy signs:

- Course/package composition, prices, dates, manual payment destinations.
- Teacher identity, biography, credentials, photos, results/testimonials and consents.
- Official MoE curriculum mapping versus teacher enrichment.
- Questions, correct answers, explanations, blueprints, timings, passing rules.
- Support staffing, refund wording, and public marketing/legal content.

Neither signoff can waive a P0 trust blocker.

## 35. Operations, Runbooks, and Support Ownership

### 35.1 Responsibility matrix

| Area                                                               | Primary owner                                                                                              | Backup/escalation                               |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Infrastructure, deploys, monitoring, incident command, backups     | Platform technical owner                                                                                   | Named trusted technical backup to be designated |
| Content, prices, exam schedule, payment business decision, refunds | Mr. Bahrawy/product owner                                                                                  | Authorized assistants                           |
| Content publishing                                                 | Content assistants and owner                                                                               | Owner                                           |
| Academic answers/subjective grading                                | Teacher and academic assistants                                                                            | Teacher                                         |
| Manual finance                                                     | Finance assistants                                                                                         | Owner                                           |
| Student support/device recovery                                    | Support assistants with explicit permission                                                                | Owner/technical owner                           |
| In-person student/guardian identity recovery                       | Two distinct trained active staff per ceremony; at least one owner/administrator approver with recent TOTP | Owner; no single-person fallback                |
| Public launch acceptance                                           | Technical owner + Mr. Bahrawy jointly                                                                      | No unilateral substitute                        |
| Security verification                                              | Independent reviewer                                                                                       | Technical owner coordinates fixes               |

The single-operator technical model is a material risk. A named technical backup must receive MFA access, recovery/runbook training, and one alert/DR tabletop before public launch so P0 acknowledgement is covered 24/7; this does not create or advertise 24/7 student support. If that cannot be arranged, record the staffing gap and fail the under-one-hour RTO launch gate rather than pretending automated alerts equal recovery.

### 35.2 Required runbook template

Every runbook includes:

- Trigger and severity.
- User impact and affected components.
- Required access/MFA and safety prerequisites.
- Exact diagnosis steps.
- Exact containment/recovery actions.
- Data-integrity checks.
- Rollback/failback.
- Student/staff/status-page wording.
- Evidence to retain.
- Escalation contacts.
- Post-incident actions and owner.

### 35.3 Required runbooks

Create and rehearse:

1. Severity classification and incident command.
2. App-node failure and horizontal scale.
3. Failed production deployment and image rollback.
4. Failed/unsafe database migration.
5. Managed database standby failover.
6. Point-in-time restore after accidental corruption.
7. Frankfurt regional disaster and Amsterdam promotion.
8. Valkey failure, lease safety, cache rebuild, and outbox replay.
9. Spaces failure and Backblaze B2 object restore.
10. Backup failure and restore verification.
11. Manual-payment backlog and twelve-hour SLA breach.
12. Duplicate/mismatched payment evidence and financial reconciliation.
13. Payment reversal/refund plus entitlement correction.
14. Scheduled-exam readiness, monitoring, and priority support.
15. Lost/late exam heartbeat or autosave incident.
16. CEQUENS outage, OTP delivery decline, and SMS-cost abuse.
17. Bunny playback/token/encoding outage.
18. Postmark outage, bounce, complaint, or domain-authentication failure.
19. DDoS, credential stuffing, account takeover, and Cloudflare escalation.
20. Compromised student, guardian, or staff account.
21. Approved-device recovery and suspicious session revocation.
22. In-person student/guardian phone/password recovery, evidence minimization, dual approval, cooldown, social-engineering rejection, and false-accept containment.
23. Secret/provider-key compromise and rotation.
24. Lost staff TOTP/break-glass access.
25. Malware upload or exposed signed link.
26. Scheduled maintenance/read-only mode.
27. Public status and user communication.
28. Account deletion/tombstone replay after backup restore.
29. Audit-chain verification failure.

Rehearse deployment rollback, PITR, regional DR, payment reconciliation, scheduled exam, CEQUENS degradation, one complete two-person in-person identity recovery, and full alert routing before public launch.

### 35.4 Operational cadence

| Frequency  | Required work                                                                                         |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| Continuous | Uptime/error/latency/security/queue/backup/provider/spend monitoring                                  |
| Daily      | Backup/replication status, payment SLA, dead letters, critical errors, disk/database health           |
| Weekly     | Dependency/vulnerability triage, failed notification/payment reconciliation, cost trend, slow queries |
| Monthly    | Timed restore test, access/role review, vendor billing/capacity, report delivery, retention evidence  |
| Quarterly  | Secret rotation, DR exercise, load regression, staff privilege review, incident/runbook review        |
| Annually   | Independent penetration test, recovery/retention/legal review, provider/architecture reassessment     |

### 35.5 Scheduled exam checklist

At least 48 hours before:

- Final immutable assessment version, blueprint, correct answers, result-release rule, duration/window, cohort, and attempts reviewed.
- No conflicting deployment/maintenance.
- Mandatory third app node provisioned and load-smoked for the defined high-stakes/fixed-window exam profile; removal of any one serving node leaves the accepted two-node capacity.
- Database/Valkey/storage/worker capacity healthy.
- Backup and restore evidence current.
- Support priority queue and staff assignment confirmed.
- Status/incident templates ready.

At T minus 60 minutes:

- Technical owner on call.
- Dashboard and synthetic autosave/submit healthy.
- Worker/outbox empty within normal range.
- Provider status normal.
- Feature/deployment freeze active.

During:

- Watch starts, active attempts, autosave latency/failure, DB connections/locks, CPU, 5xx, support.
- Never bulk reset attempts automatically.
- Warn/log tab/fullscreen events only.

After:

- Observe submissions and timeout finalization through T plus 30 minutes.
- Reconcile attempt count, answer count, grade count, outbox, and support incidents.
- Release results only by configured policy.
- Scale down temporary node after observation and evidence capture.

## 36. Launch Readiness Checklists

### 36.0 Authoritative Lean V1 go-live checklist

- [ ] Hostinger KVM 4 and domain purchased; actual hPanel CPU/RAM/disk/monthly-transfer/renewal terms recorded; billing alerts and MFA enabled.
- [ ] Cloudflare Free proxies web/API/admin with Full (strict) TLS, DNSSEC, WAF/rate rules and origin restriction; `media` is DNS-only with valid NGINX TLS and exposes only signed HLS.
- [ ] Docker Compose/Ansible rebuild from clean Ubuntu succeeds; containers are non-root with resource/log limits; only 80/443 and restricted SSH are public; PostgreSQL, Valkey, Docker socket, metrics and backups are private.
- [ ] PostgreSQL/Valkey/NGINX/files/HLS use persistent volumes with correct ownership; total disk is below 65%, ≥25% remains free and 65/75% alerts work.
- [ ] Encrypted PostgreSQL backup reaches private R2 every six hours within allowance; weekly automated restore verification and timed clean-host rebuild pass; offline encryption/repository/registrar recovery material exists in two copies.
- [ ] Better Stack external synthetics and private Telegram P0/P1 alerts work during a deliberate VPS shutdown; logs/alerts contain no PII, passwords, tokens, payment proof, questions/answers or signed URLs.
- [ ] No public self-registration, OTP/CEQUENS, application email/Postmark, Bunny, Sentry, DigitalOcean or Backblaze launch dependency/credential/job/template exists. Optional email and all phones display as `UNVERIFIED_V1` where status is shown.
- [ ] Pre-created student, guardian and staff activation credentials are high entropy, hashed, expiring, one-use, shown once, rate-limited and audited; phone/code/name alone cannot activate or enumerate an account.
- [ ] Phone/password login, current-password change, staff-issued server-generated temporary reset, `mustChangePassword`, global session revocation and contact correction pass concurrency/IDOR/audit tests. Staff never sets/views permanent passwords; weak remote evidence cannot approve recovery.
- [ ] Staff app requires matching Cloudflare Access assertion, app password and non-replayed TOTP; bootstrap is closed; recovery codes, last-owner protection, two-person recovery and role scopes pass.
- [ ] Workstation encoding produces checksum-verified 720p/480p H.264/AAC HLS with aligned 6–10-second segments; two physical 1080p master copies exist; no master remains on production.
- [ ] API/NGINX signed-HLS authorization, expiry, wrong user/device/lesson/origin rejection, moving name/ID watermark, 720p default, 480p ABR/data-saver, seek/2×, resume and server-validated 90% unique-watch completion all pass. Direct directory/MP4/master access fails.
- [ ] Section 33 V1 mixed/video/combined/exam/soak/fault tests pass; the accepted concurrency number and 30% headroom are recorded. 8/10/12 TB transfer and storage migration triggers are dashboarded/tested.
- [ ] Manual payment, ledger, entitlement, exam durability, guardian record scope, two-device/one-activity lease, private files, audit chain, Arabic RTL/mobile UX, accessibility limitations and all P0 E2E tests pass.
- [ ] 30–50-person restricted-production pilot across Egyptian mobile/home networks passes; actual playback bitrate, rebuffering, peak concurrency, API latency, disk and transfer projections are reviewed before public promotion.
- [ ] Rollback, R2 restore/rebuild, Hostinger outage, database corruption, disk/transfer pressure, compromised account, password recovery, video leak, exam and payment reconciliation runbooks are rehearsed with named operator/support owners.

Any checklist item below that requires DigitalOcean, Bunny, CEQUENS, Postmark, Sentry, Backblaze, public OTP registration, multi-node HA, 2,000 concurrent users, one-hour RTO or 15-minute RPO is a **deferred funded gate**, not a Lean V1 gate.

### 36.1 Owner-provided content and business inputs

- [ ] Production domain selected, purchased, registrar-locked, MFA protected.
- [ ] Final Arabic/English academy and teacher display names confirmed.
- [ ] Professional teacher photography and logo/wordmark assets supplied in required variants.
- [ ] Teacher biography, qualifications, experience, contact/social links approved.
- [ ] Testimonials/results are real, consented, and safely displayed.
- [ ] 2026/27 cohort and term dates supplied.
- [ ] Individual course, term, full-year product composition, EGP prices, sale windows, fixed end dates supplied.
- [ ] Upgrade paths and eligible prior-purchase policy approved.
- [ ] InstaPay and mobile-wallet destinations/instructions supplied and tested.
- [ ] Support WhatsApp link and 10:00–22:00 staffing confirmed.
- [ ] In-person recovery branch/hours and appointment wording confirmed; two distinct trained active human staff are rostered for each ceremony, at least one owner/administrator has `identity.recovery.approve` plus working recent TOTP, and owner escalation within four staffed hours is operational.
- [ ] Refund, terms, privacy, acceptable-use, copyright, and contact copy supplied.
- [ ] First 4–6 weeks of videos/PDFs/questions organized and academically reviewed; every meaningful image has a reviewed short alternative and explicit simple/complex decision, every complex instructional image also has an equivalent long description, and every launch PDF is tagged/semantic or has a complete accessible HTML/text equivalent.
- [ ] Official MoE mapping and teacher-enrichment labels approved.
- [ ] Every launch assessment answer/explanation/blueprint reviewed by Mr. Bahrawy.
- [ ] Every public page, teacher claim, testimonial, review-display mode, and legal-policy version has real approved content and the required consent/version evidence.

The owner elected to launch before Egyptian legal/accounting review. Record that accepted risk prominently, do not claim compliance, and seek professional review urgently. This decision does not waive technical security, correctness, retention, or audit requirements.

### 36.2 Deferred funded vendor/accounts checklist

- [ ] GitHub, registrar, DigitalOcean, Cloudflare, Bunny, CEQUENS, Postmark, Sentry, Better Stack, and Backblaze billing and MFA valid; the Backblaze account is confirmed in EU Central before first upload.
- [ ] CEQUENS production route/sender/templates approved and test delivery verified.
- [ ] Postmark sender domain passes SPF/DKIM/DMARC and bounce webhooks.
- [ ] Bunny production library funded, domain allowlist/Basic DRM/direct-link block/no-MP4 verified.
- [ ] Cloudflare DNSSEC, Full strict TLS, cache rules, WAF, Turnstile, rate rules tested.
- [ ] Spend alerts/caps configured.
- [ ] GitHub Actions/GHCR and telemetry ingestion/retention allowances are recorded; the approximately $294–307 baseline and mandatory exam/load/DR burst costs are explicitly approved.
- [ ] Status page and Telegram/email alert chain verified.
- [ ] Offline recovery codes and trusted backup contact prepared.

### 36.3 Deferred funded infrastructure/recovery checklist

- [ ] Terraform plan clean and no unexplained drift.
- [ ] Two app nodes, worker, small functional staging, load balancer, HA database, Valkey, Spaces, warm DR origin/replica, and Backblaze B2 copy path healthy.
- [ ] Initial 47-connection database budget, four API processes, PgBouncer/Prisma pools, worker/migration/admin/reporting reserves, and staging container memory ceilings are configured and proven under load.
- [ ] Origin/database/Valkey/SSH restrictions validated.
- [ ] Container non-root/resource/log/digest controls validated; every fixed non-root service can read only its own `/run/secrets` files, while another service, image history, `docker inspect`, logs, CI artifacts, and deploy temporaries expose none.
- [ ] `assets.academy.example` serves checksummed assets for the current and three prior build IDs; old/new HTML chunk resolution and empty-cache rolling-deploy smoke pass.
- [ ] Per-app deployment IDs/prefixes, no-Server-Actions build gate, long-lived-browser version-skew test, production deployment concurrency/CAS lock, and warm-DR exact-release readiness all pass.
- [ ] Managed standby failover tested.
- [ ] PITR/logical restore under one hour with data integrity checks.
- [ ] DR replica lag monitored and promotion rehearsed.
- [ ] DR drill fences the old writer, promotes the replica, provisions a new standby and Valkey, uses incident-only B2 reads/static failover, hydrates DR Spaces, deploys second app/worker, and revokes incident credentials before full reopen.
- [ ] Spaces-to-Backblaze B2 copy, manifest reconciliation, Object Lock/lifecycle behavior, credential separation, and timed restore pass under target.
- [ ] Audit-chain root restore/verification passes.
- [ ] External maintenance/status page survives origin shutdown.
- [ ] Named primary/backup technical responders acknowledge a 24/7 P0 alert and rehearse the under-one-hour recovery path; student support remains 10:00–22:00.

### 36.4 Application and security

- [ ] Exact release SHA, image digests, SBOM, signatures, migrations recorded.
- [ ] No floating dependencies/images.
- [ ] V1 activation credential, phone/password, session, CSRF, CORS, staff TOTP and rate controls pass; OTP routes are absent.
- [ ] Student/guardian primary-guardian and two-person in-person recovery plus staff-factor/other-owner recovery pass end to end; no remote/knowledge/reason-text bypass exists, evidence is minimized, and the 24-hour cooldown/notices/false-accept response work.
- [ ] First-owner bootstrap is closed after setup; no seeded/default admin credential exists; staff invitation, role hierarchy, TOTP recovery/reenrollment, recovery-code custody, and last-owner protection pass.
- [ ] Offline-roster activation reservation/recovery/concurrency and guardian invitation/transfer/revocation pass with pre-created accounts and one-use credentials; no OTP authority exists in V1.
- [ ] Two-device/staff-only removal/one-active-session rules pass concurrency tests.
- [ ] Guardian/student/staff authorization matrix and IDOR suite pass.
- [ ] Manual-payment/ledger/entitlement/upgrade/refund idempotency passes both product and funding-adjustment branches, zero-value settlement, refund unknown/late completion, access disposition, top-up reversal and expiry races.
- [ ] Payment decisions/confirmations appear only in the authenticated app; no payment-status SMS/email or generated/downloadable receipt or tax-invoice path exists.
- [ ] Exam autosave/timer/reconnect/submit/release durability pass.
- [ ] Upload scan/MIME/size/signed URL/view-only/video security pass.
- [ ] No PII/secrets in logs, Sentry, Better Stack, source maps, CI artifacts.
- [ ] Audit history immutable and chain verifies.
- [ ] Added module flags default false and API-enforced.
- [ ] Public-preview authorization is isolated from entitlement/progress/file/Q&A paths and passes anonymous-session, origin, duration, renewal, concurrency, and rate-limit tests.
- [ ] Course-review eligibility, moderation, anonymous default, dual-consent named display, edit/withdrawal, and account-deletion behavior pass.
- [ ] XLSX/CSV import/export formula-injection, archive traversal/zip-bomb, image-alternative, Arabic RTL, and atomic-failure tests pass.
- [ ] No open nonwaivable critical/high finding.

### 36.5 Product/content/UX

- [ ] Public, student, guardian, and staff journeys complete in Arabic RTL.
- [ ] Light/dark/responsive/mixed-direction states reviewed.
- [ ] Loading, empty, offline, forbidden, expired, error, retry, success states exist.
- [ ] PWA install/data saver works; sensitive/paid content is not offline-cached.
- [ ] Every entitled video transcodes, plays, carries the moving real-name/student-ID watermark, resumes, and tracks unique watch; every public preview uses only academy/session marking and earns no progress.
- [ ] Every PDF/resource has correct view/download mode and satisfies the accessible-PDF-or-equivalent publication gate.
- [ ] Catalog shows correct product, price, end date, upgrade amount.
- [ ] COURSE/TERM/FULL_YEAR content-grant cardinality and the shared entitlement-scope resolver pass for lessons, files, media, assessments, progress, and upgrades.
- [ ] Manual payment shows status only and never claims receipt/tax invoice.
- [ ] Course/lesson schedule and prerequisites reviewed.
- [ ] No empty future-grade, certificate, leaderboard, Google, Paymob, live, cast, caption, or offline-video UI.
- [ ] Native Arabic copy review complete.
- [ ] UI/non-video accessibility gate passes; no whole-product AA claim.

### 36.6 QA and operations

- [ ] Unit/integration/API/E2E/accessibility suites green.
- [ ] Section 33 Lean V1 mixed, real-HLS, combined, exam, soak and dependency-fault stages pass with 30% headroom; accepted concurrency and transfer projection are recorded.
- [ ] Production-size synthetic load stack was isolated from staging/production, retained no PII, produced archived evidence, and was torn down after the final run.
- [ ] 30–50-person pilot complete.
- [ ] Pilot ran only in access-restricted production with production integrations; staging/load environments contain no pilot PII.
- [ ] Pilot allowlist has no client/query/IP bypass; callback/monitor exceptions are service-authenticated; every July 31 stage meets minimum samples/numeric thresholds and has both required evidence/approvals.
- [ ] Independent review complete and findings retested.
- [ ] Restore, DR, rollback, payment reconciliation, scheduled-exam, two-person in-person identity recovery, and alert runbooks rehearsed with linked evidence.
- [ ] Support coverage confirmed.
- [ ] 24/7 technical P0 responder coverage and 10:00–22:00 student/finance support are separately confirmed.
- [ ] Known defects/waivers recorded and allowed.
- [ ] Technical owner and Mr. Bahrawy signed the release record.

## 37. Post-Launch Roadmap

### 37.1 Days 1–14: stabilization

- Review errors, latency, activation/password recovery, payments, exams, queue, support, database, disk, real video concurrency/rebuffering and monthly-transfer projection daily.
- Ship only P0/P1 fixes and already-approved flagged modules.
- Perform an additional restore by day 7.
- Reconcile ledger/entitlements and attempts/answers daily.
- Tune WAF/rate limits from real abuse without blocking carrier NAT.
- Measure actual video GB per student-hour/rendition, 720p-to-480p fallback rate, peak concurrent streams, activation/reset support load, and tickets per 100 users.
- Train a second technical responder.

### 37.2 Weeks 3–6: complete target modules and content

- Release assignments, published FAQ, coupons, monthly reports, and practice bank one at a time after full gates.
- Encode/migrate only scheduled content in controlled manifest batches with checksums and playback QA; keep 1080p masters in two offline physical copies, not on production.
- Run a second authorization review after target modules are live.
- Refine in-app lifecycle notifications and guardian preferences; no external delivery is implied.
- Review support backlog and teacher/assistant workload.

### 37.3 Months 2–3: automation and measured scale

- Repeat progressively higher combined/video/fixed-exam profiles using production-derived synthetic traffic; never jump directly to a 2,000-concurrent claim.
- Migrate HLS to the `R2_EDGE`/specialized delivery adapter or upgrade the VPS when section 27 triggers fire; add separate app/database/Valkey nodes only from measured evidence and an approved recurring budget.
- Evaluate CEQUENS OTP as a separate identity-verification release: provider approval, cost/abuse controls, new-account verification and an honest campaign for every existing `UNVERIFIED_V1` contact. Do not bolt it onto V1 silently.
- Evaluate transactional email only when there is a concrete delivery use case, verified addresses, domain authentication, bounce/privacy handling and an approved budget.
- Formalize business/payment readiness and implement Paymob through the existing provider adapter after merchant approval.
- Add webhook reconciliation and provider confirmations without changing entitlement invariants.
- Expand communication/retention features.
- Run financial-ledger and DR drills.

### 37.4 Months 4–6: practice, competition, and future product

- Add richer practice analytics/question types only after English academic review.
- Add the course-only real-name leaderboard with separate student and guardian opt-in and withdrawal.
- Evaluate additional grades/cohorts through the data-driven model.
- Evaluate Enterprise DRM only if measured piracy and revenue justify cost/compatibility.
- Prioritize captions/transcripts to close the accessibility gap.
- Evaluate native apps, casting, audio questions, or live learning as separate products; offline video remains a native/DRM decision.
- Certificates and Google login have no committed release.

## 38. Definition of Done for Every Feature

A feature is done only when all applicable items are true:

1. Locked business behavior and state transitions are implemented.
2. Server-side permission and record-scope authorization is tested.
3. Database constraints/indexes/migration and rollback compatibility exist.
4. Idempotency/concurrency/retry behavior is proven.
5. Arabic RTL, English content direction, responsive light/dark UI are complete.
6. Loading, empty, validation, offline, forbidden, expired, provider-failure, retry, success states exist.
7. Accessibility UI checks pass.
8. Security and privacy controls, redaction, file safety, rate limits are complete.
9. Domain/outbox/audit events and observability exist.
10. Unit, integration, API, E2E, and applicable load tests pass.
11. Admin/operator workflow, support wording, and runbook exist.
12. Feature flag and emergency kill switch exist when specified.
13. Production content/copy is reviewed; no fabricated placeholder remains.
14. Acceptance evidence is linked to the release record.

No TODO, disabled button, fake data, placeholder credential, silent catch, unhandled provider error, or unreviewed schema shortcut is acceptable in an enabled production path.

## 39. Requirement Traceability and Explicit Exclusions

| Initial requirement area                              | Final disposition                                                                                                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Four grades                                           | Architecture supports them; public launch exposes only Third Secondary 2026/27 English                                                                                                                |
| Student/teacher/admin                                 | Expanded to student, guardian, owner/admin, content, academic, finance, support, analyst permissions                                                                                                  |
| Phone/password/Google                                 | V1 phone + password on pre-created accounts; phone/email explicitly unverified; no OTP, self-registration, Google login, application email, or automated recovery. Future OTP is a separate migration |
| Offline four-digit codes                              | Non-secret identifiers 0001–9999 scoped by branch/cohort; activation requires the matching pre-created roster/account plus a separate high-entropy one-use credential, never the code alone           |
| Online codes above 10,000                             | Start at 10001; non-secret                                                                                                                                                                            |
| Homepage/catalog/details/previews                     | P0, fully CMS/data-driven                                                                                                                                                                             |
| Protected videos                                      | Private self-hosted HLS behind API-issued short sessions and NGINX validation; 720p default/480p fallback; moving name+ID watermark; provider adapter; no true-DRM or absolute screen-recording claim |
| PDFs/resources                                        | P0 view-only or explicitly downloadable with authorization                                                                                                                                            |
| MCQ/exams/question bank                               | Single-answer text/image/passage MCQ P0; imports, blueprint, timers, autosave, releases                                                                                                               |
| Matching/fill/essay exam types                        | Not objective launch types; typed/file subjective work is separate flagged assignment module                                                                                                          |
| Per-question timers and configurable MCQ attempt caps | Deferred; launch has whole-attempt timer/window, unlimited lesson quizzes, one chapter/final attempt plus audited one-use authorization                                                               |
| Monthly summaries                                     | In-app guardian portal/report only in V1; email/SMS delivery deferred                                                                                                                                 |
| Student dashboard/progress/streak                     | Core progress P0; report/streak depth under target/report modules                                                                                                                                     |
| Standalone practice bank                              | Added July target                                                                                                                                                                                     |
| Leaderboard                                           | Post-launch course-only real names with student+guardian opt-in                                                                                                                                       |
| Certificates                                          | Excluded; no committed release                                                                                                                                                                        |
| Manual payment                                        | P0 InstaPay/wallet proof/reference, finance review, status confirmation                                                                                                                               |
| Paymob/cards/Fawry                                    | Post-launch after business/merchant approval                                                                                                                                                          |
| Coupons                                               | Added July target                                                                                                                                                                                     |
| Private lesson questions                              | P0                                                                                                                                                                                                    |
| Public lesson questions                               | Added target only as moderated anonymized FAQ, never an open forum                                                                                                                                    |
| Live chat                                             | Excluded                                                                                                                                                                                              |
| Subjective uploads/grading                            | Added July target, typed + image/PDF, 48-hour grading SLA                                                                                                                                             |
| Device controls                                       | Two devices, staff-only removal, one active learning/exam lease                                                                                                                                       |
| Parent access                                         | Required verified primary, optional secondary; many children; defined view/payment boundaries                                                                                                         |
| SMS/email/WhatsApp                                    | No application SMS/email in V1; WhatsApp is a human support contact only and never sufficient identity proof or an automated integration                                                              |
| Live classes                                          | Excluded                                                                                                                                                                                              |
| Native apps/offline video/casting                     | Excluded from launch; offline video deferred                                                                                                                                                          |
| Captions/audio questions                              | Excluded from launch; accessibility limitation documented                                                                                                                                             |
| Course reviews                                        | Verified enrolled-student, moderated                                                                                                                                                                  |
| Branches                                              | One center at launch; multi-branch-ready model                                                                                                                                                        |
| Multi-teacher marketplace                             | Excluded; single-teacher academy                                                                                                                                                                      |

## 40. Final Assumptions and Owner Decisions

- Organization: one academy, one teacher, one English subject, Third Secondary pilot.
- Academic model: Egyptian Ministry of Education 2026/27 mapping plus clearly labeled teacher enrichment.
- Cohorts are yearly and historical data is preserved.
- Each non-anonymized student, guardian, and staff account reserves its own distinct normalized mobile number at launch, but every V1 number is explicitly `UNVERIFIED_V1`; a shared-number/multi-person credential model is excluded.
- Currency is EGP; dates/times use Africa/Cairo.
- Products are course, term, and full-year, each with a fixed cohort end date.
- Prices, product membership, dates, domain, bio, photos, testimonials, legal copy, and payment destinations are owner inputs.
- Business remains an individual teacher at planning time.
- Owner accepted launching manual paid access before Egyptian legal/accounting review; the system must not claim compliance or fiscal-receipt capability.
- Lean V1 recurring services are Hostinger KVM 4 plus the domain. Cloudflare Free/R2 within allowance, Better Stack within allowance, Telegram, PostgreSQL, Valkey, NGINX, FFmpeg and ClamAV add no subscription cost. Renewal prices, taxes, payment fees, free-tier overages and operator time remain variable and must be checked before purchase.
- Planning Hostinger KVM 4 profile is 4 vCPU, 16 GB RAM, 200 GB NVMe and 16 TB monthly transfer; the purchased hPanel limits are authoritative. It is a single failure domain, not HA.
- Capacity population is about 3,000 students. Four two-hour weekly lessons equal eight watch-hours per fully active student/month; 3,000 fully active students equal 24,000 watch-hours, not 3,000 concurrent streams. The 720p-default/480p-fallback planning forecast including about 15% overhead/rewatch is roughly 12 TB/month and must be replaced by observed data.
- Launch concurrency is the highest KVM 4 combined load stage passing section 33 with 30% headroom. No 2,000-concurrent promise exists in V1.
- V1 total-host-loss objective is RPO at most six hours and RTO at most four hours when required providers/access/operator are available; multi-node sub-hour/15-minute DR is deferred.
- The user is the primary technical operator.
- July 31 is a public-core target; added modules are hidden if they fail.
- First four weeks launch at one two-hour lesson/week. Encode HLS offline and keep two physical copies of every 1080p master; production stores only the 720p/480p HLS renditions needed for delivery.
- No captions means no full WCAG 2.2 AA conformance claim.

## 41. Official Reference Baseline

Reverify all service availability, account approval, regional support, and prices at implementation/purchase time.

- [Hostinger VPS plans and current KVM 4 resources](https://www.hostinger.com/vps-hosting)
- [Hostinger plan parameters and hPanel source of truth](https://support.hostinger.com/en/articles/6976044-parameters-and-limits-of-hosting-plans-in-hostinger)
- [Cloudflare policy for delivering video](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/delivering-videos-with-cloudflare/)
- [Cloudflare R2 pricing and free allowance](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare R2 getting started](https://developers.cloudflare.com/r2/get-started/)
- [FFmpeg HLS muxer/format documentation](https://ffmpeg.org/ffmpeg-formats.html)
- [Node.js release status](https://nodejs.org/en/about/previous-releases)
- [Next.js 16](https://nextjs.org/blog/next-16)
- [Next.js deployment ID configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId)
- [Next.js self-hosting and version-skew guidance](https://nextjs.org/docs/app/guides/self-hosting)
- [NestJS 11 migration/support baseline](https://docs.nestjs.com/migration-guide)
- [Prisma ORM 7 upgrade baseline](https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7)
- [DigitalOcean managed databases](https://docs.digitalocean.com/products/databases/)
- [DigitalOcean PostgreSQL pricing](https://docs.digitalocean.com/products/databases/postgresql/details/pricing/)
- [DigitalOcean PostgreSQL connection limits](https://docs.digitalocean.com/products/databases/postgresql/details/limits/)
- [DigitalOcean PostgreSQL read-only nodes and promotion](https://docs.digitalocean.com/products/databases/postgresql/how-to/add-read-only-nodes/)
- [DigitalOcean Droplet pricing](https://docs.digitalocean.com/products/droplets/details/pricing/)
- [DigitalOcean load-balancer features](https://docs.digitalocean.com/products/networking/load-balancers/details/features/)
- [DigitalOcean load-balancer pricing](https://docs.digitalocean.com/products/networking/load-balancers/details/pricing/)
- [DigitalOcean Spaces pricing](https://docs.digitalocean.com/products/spaces/details/pricing/)
- [Backblaze B2 pricing](https://www.backblaze.com/cloud-storage/pricing)
- [Backblaze B2 data regions](https://www.backblaze.com/docs/cloud-storage-data-regions)
- [Backblaze B2 server-side encryption](https://www.backblaze.com/docs/cloud-storage-server-side-encryption)
- [Backblaze B2 Object Lock](https://www.backblaze.com/docs/cloud-storage-object-lock)
- [Cloudflare rate limiting](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Cloudflare account-takeover protection](https://developers.cloudflare.com/use-cases/solutions/stop-account-takeover-attacks/)
- [Bunny Stream security](https://docs.bunny.net/stream/security-options)
- [Bunny MediaCage DRM](https://docs.bunny.net/stream/drm)
- [Bunny playback control API](https://docs.bunny.net/stream/playback-api)
- [Bunny Stream pricing](https://docs.bunny.net/stream/pricing)
- [CEQUENS developer hub](https://developer.cequens.com/)
- [CEQUENS verification hub](https://www.cequens.com/products/verification-hub)
- [Postmark developer documentation](https://postmarkapp.com/developer/)
- [Postmark email API](https://postmarkapp.com/developer/api/email-api)
- [Postmark pricing](https://postmarkapp.com/pricing)
- [Better Stack pricing](https://betterstack.com/pricing)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [OWASP Application Security Verification Standard](https://owasp.org/www-project-application-security-verification-standard/)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [Egyptian Tax Authority e-commerce guidance](https://portal.eta.gov.eg/en/node/277)
- [Egyptian Tax Authority consumer-sale receipt guidance](https://www.eta.gov.eg/ar/news/alaltzam-balbyanat-almnsws-lyha-qanwna-baysalat-alby-llmsthlk-alnhayy-fatwrt-alby-llmsthlk)
- [Egyptian Personal Data Protection Centre guidance](https://pdpc.gov.eg/assets/pdf-data/Guidelines/DPO.pdf)

---

## Final Handoff Instruction

Antigravity should implement the specification as staged vertical slices, keeping the system deployable after every accepted slice. Start with the trust foundation—identity, guardian isolation, RBAC, audit, database durability, CI, staging, backups—then complete registration/claim, catalog/content, manual commerce/entitlements, protected learning, MCQ assessments, and operations end to end. Treat the added July modules as separate deployable flags. Do not optimize for a visually impressive demo at the cost of payment, exam, privacy, or recovery correctness.

The implementation is ready for public use only when the release record proves every nonwaivable gate and both release owners sign it.
