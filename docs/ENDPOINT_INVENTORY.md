# Endpoint Inventory

This is the initial endpoint-family inventory. It must not be treated as authorization
documentation or as approval to remove legacy routes. A route-by-route inventory remains
required before legacy controller removal.

Permission names in the tables below are target capabilities. Current implementation
uses the canonical `StaffPermission` values: `CATALOG_MANAGE`, `PRODUCT_MANAGE`,
`STUDENT_MANAGE`, `PAYMENT_MANAGE`, `SUPPORT_MANAGE`, `STAFF_MANAGE`, and
`ASSESSMENT_MANAGE`.

## admin-assessment.controller.ts
| Endpoint | Auth & Perm | Request | Response | Side Effects | Archive / Delete | Canonical /admin/v1 | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /admin/assessment/questions` | Staff, VIEW_QUESTIONS | `?gradeId, courseId` | `Question[]` | None | N/A | `/admin/v1/questions` | Keep |
| `GET /admin/assessment/questions/:id` | Staff, VIEW_QUESTIONS | `id` | `Question` | None | N/A | `/admin/v1/questions/:id` | Keep |
| `POST /admin/assessment/questions` | Staff, EDIT_QUESTIONS | `QuestionCreateDto` | `Question` | Creates Question | Archive | `/admin/v1/questions` | Keep |
| `PUT /admin/assessment/questions/:id`| Staff, EDIT_QUESTIONS | `QuestionUpdateDto` | `Question` | Updates Question | N/A | `/admin/v1/questions/:id` | Keep |
| `DELETE /admin/assessment/questions/:id`| Staff, EDIT_QUESTIONS | `id` | `Success` | Deletes Question | Permanent (if unused) | `/admin/v1/questions/:id` | Keep |

## admin-catalog.controller.ts
| Endpoint | Auth & Perm | Request | Response | Side Effects | Archive / Delete | Canonical /admin/v1 | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /admin/catalog/courses` | Staff, EDIT_CATALOG | `CreateCourseDto` | `Course` | Creates Course | Archive | `/admin/v1/courses` | Keep |
| `POST /admin/catalog/courses/:id/publish`| Staff, EDIT_CATALOG | `id` | `Course` | Updates status to PUBLISHED | N/A | `/admin/v1/courses/:id/publish` | Keep |
| `POST /admin/catalog/courses/:id/archive`| Staff, EDIT_CATALOG | `id` | `Course` | Updates status to ARCHIVED | Archive | `/admin/v1/courses/:id/archive` | Keep |
| `DELETE /staff/courses/:courseId` | Staff, EDIT_CATALOG | `id` | `Success` | Soft delete via archivedAt | Archive | `/admin/v1/courses/:id` | Remove |

## admin-content.controller.ts
| Endpoint | Auth & Perm | Request | Response | Side Effects | Archive / Delete | Canonical /admin/v1 | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /admin/grades/:gradeId/bundles` | Staff, EDIT_CONTENT | `CreateBundleDto` | `Product` | Creates Product (Bundle) | Archive | `/admin/v1/products` | Keep |
| `DELETE /admin/bundles/:productId` | Staff, EDIT_CONTENT | `id` | `Success` | Updates status to ARCHIVED | Archive | `/admin/v1/products/:id` | Keep |

## students.controller.ts
| Endpoint | Auth & Perm | Request | Response | Side Effects | Archive / Delete | Canonical /admin/v1 | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /staff/students/:studentId/suspend` | Staff, MANAGE_ACCOUNTS| `id` | `Success` | Revokes sessions/access | N/A | `/admin/v1/students/:id/suspend` | Keep |
| `POST /staff/students/:studentId/reinstate`| Staff, MANAGE_ACCOUNTS| `id` | `Success` | Restores access | N/A | `/admin/v1/students/:id/reinstate` | Keep |

## support.controller.ts
| Endpoint | Auth & Perm | Request | Response | Side Effects | Archive / Delete | Canonical /admin/v1 | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /support` | Staff, VIEW_SUPPORT | `?status` | `Ticket[]` | None | N/A | `/admin/v1/support` | Keep |
| `POST /support/:id/reply` | Staff, REPLY_SUPPORT| `MessageDto` | `Message` | Notifies user, marks staff_replied | N/A | `/admin/v1/support/:id/reply` | Keep |

## Known overlapping route families

- Catalog and content: `/admin/catalog`, `/admin`, and `/staff`
- Payments: `/payments` and `/payment`
- Assessments: `/admin/assessment`, `/assessment`, and `/assessments`
- Dashboards and students: `/dashboard/staff/*` and `/staff/students/*`

No legacy route may be removed until its exact request shape, response shape, side
effects, permission, organization scope, and replacement route are recorded here.
