import { Module } from '@nestjs/common';
import { AdminV1QuestionsController } from './questions.controller';
import { AdminV1QuestionsService } from './questions.service';
import { AdminAuditService } from '../common/services/audit.service';

@Module({
  controllers: [AdminV1QuestionsController],
  providers: [AdminV1QuestionsService, AdminAuditService],
})
export class AdminV1QuestionsModule {}
