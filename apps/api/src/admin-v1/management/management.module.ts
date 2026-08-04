import { Module } from '@nestjs/common';
import { AdminAuditService } from '../common/services/audit.service';
import { AdminV1ManagementController } from './management.controller';
import { AdminV1ManagementService } from './management.service';

@Module({
  controllers: [AdminV1ManagementController],
  providers: [AdminV1ManagementService, AdminAuditService],
})
export class AdminV1ManagementModule {}
