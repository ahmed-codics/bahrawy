CREATE INDEX "Account_organizationId_kind_status_archivedAt_deletedAt_idx"
  ON "Account"("organizationId", "kind", "status", "archivedAt", "deletedAt");

CREATE INDEX "Course_organizationId_gradeId_status_updatedAt_idx"
  ON "Course"("organizationId", "gradeId", "status", "updatedAt");

CREATE INDEX "Product_organizationId_gradeId_status_updatedAt_idx"
  ON "Product"("organizationId", "gradeId", "status", "updatedAt");

CREATE INDEX "PaymentOrder_organizationId_status_createdAt_idx"
  ON "PaymentOrder"("organizationId", "status", "createdAt");

CREATE INDEX "Question_organizationId_gradeId_archivedAt_updatedAt_idx"
  ON "Question"("organizationId", "gradeId", "archivedAt", "updatedAt");

CREATE INDEX "AuditEvent_organizationId_targetType_targetId_createdAt_idx"
  ON "AuditEvent"("organizationId", "targetType", "targetId", "createdAt");

CREATE INDEX "AuditEvent_organizationId_actorId_action_createdAt_idx"
  ON "AuditEvent"("organizationId", "actorId", "action", "createdAt");

CREATE INDEX "SupportTicket_organizationId_status_createdAt_idx"
  ON "SupportTicket"("organizationId", "status", "createdAt");
