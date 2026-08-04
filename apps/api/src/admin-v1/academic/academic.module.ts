import { Module } from '@nestjs/common';
import { AdminV1AcademicController } from './academic.controller';
import { AdminV1AcademicService } from './academic.service';
import { AdminAuditService } from '../common/services/audit.service';

@Module({
  controllers: [AdminV1AcademicController],
  providers: [AdminV1AcademicService, AdminAuditService],
})
export class AdminV1AcademicModule {}
