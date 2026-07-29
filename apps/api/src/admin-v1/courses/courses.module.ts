import { Module } from '@nestjs/common';
import { AdminV1CoursesController } from './courses.controller';
import { AdminV1CoursesService } from './courses.service';
import { AdminAuditService } from '../common/services/audit.service';

@Module({
  controllers: [AdminV1CoursesController],
  providers: [AdminV1CoursesService, AdminAuditService],
})
export class AdminV1CoursesModule {}
