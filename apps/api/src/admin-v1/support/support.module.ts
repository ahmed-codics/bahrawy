import { Module } from '@nestjs/common';
import { AdminAuditService } from '../common/services/audit.service';
import { AdminV1SupportController } from './support.controller';
import { AdminV1SupportService } from './support.service';

@Module({
  controllers: [AdminV1SupportController],
  providers: [AdminV1SupportService, AdminAuditService],
})
export class AdminV1SupportModule {}
