import { Module } from '@nestjs/common';
import { AdminAuditService } from '../common/services/audit.service';
import { AdminV1PaymentsController } from './payments.controller';
import { AdminV1PaymentsService } from './payments.service';

@Module({
  controllers: [AdminV1PaymentsController],
  providers: [AdminV1PaymentsService, AdminAuditService],
})
export class AdminV1PaymentsModule {}
