import { Module } from '@nestjs/common';
import { OfflineCodesService } from './offline-codes.service';
import { AdminAuditService } from '../admin-v1/common/services/audit.service';
import { OfflineCodesController } from './offline-codes.controller';

@Module({
  providers: [OfflineCodesService, AdminAuditService],
  controllers: [OfflineCodesController],
  exports: [OfflineCodesService],
})
export class OfflineCodesModule {}
