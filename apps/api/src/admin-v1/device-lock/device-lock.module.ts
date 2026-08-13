import { Module } from '@nestjs/common';
import { AdminAuditService } from '../common/services/audit.service';
import { AdminV1DeviceLockController } from './device-lock.controller';
import { AdminV1DeviceLockService } from './device-lock.service';

@Module({
  controllers: [AdminV1DeviceLockController],
  providers: [AdminV1DeviceLockService, AdminAuditService],
})
export class AdminV1DeviceLockModule {}
