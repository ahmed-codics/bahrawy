import { Module } from '@nestjs/common';
import { AdminAuditService } from '../common/services/audit.service';
import { AdminV1VideoAccessService } from './video-access.service';
import { AdminV1VideoAccessController } from './video-access.controller';

@Module({
  controllers: [AdminV1VideoAccessController],
  providers: [AdminV1VideoAccessService, AdminAuditService],
  exports: [AdminV1VideoAccessService],
})
export class AdminV1VideoAccessModule {}
