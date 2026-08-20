import { Module } from '@nestjs/common';
import { AdminAuditService } from '../common/services/audit.service';
import { AdminV1StudentQuestionsController } from './student-questions.controller';
import { AdminV1StudentQuestionAttachmentsController } from './admin-student-question-attachments.controller';
import { AdminV1StudentQuestionsService } from './student-questions.service';

@Module({
  controllers: [
    AdminV1StudentQuestionsController,
    AdminV1StudentQuestionAttachmentsController,
  ],
  providers: [AdminV1StudentQuestionsService, AdminAuditService],
})
export class AdminV1StudentQuestionsModule {}
