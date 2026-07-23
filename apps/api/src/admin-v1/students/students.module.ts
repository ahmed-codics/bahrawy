import { Module } from '@nestjs/common';
import { AdminAuditService } from '../common/services/audit.service';
import { AdminV1StudentsController } from './students.controller';
import { AdminV1StudentsService } from './students.service';

@Module({
  controllers: [AdminV1StudentsController],
  providers: [AdminV1StudentsService, AdminAuditService],
})
export class AdminV1StudentsModule {}
