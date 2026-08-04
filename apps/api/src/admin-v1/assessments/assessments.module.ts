import { Module } from '@nestjs/common';
import { AdminV1AssessmentsController } from './assessments.controller';
import { AdminV1AssessmentsService } from './assessments.service';
import { AdminAuditService } from '../common/services/audit.service';

@Module({
  controllers: [AdminV1AssessmentsController],
  providers: [AdminV1AssessmentsService, AdminAuditService],
})
export class AdminV1AssessmentsModule {}
