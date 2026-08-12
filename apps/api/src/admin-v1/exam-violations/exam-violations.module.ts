import { Module } from '@nestjs/common';
import { AdminV1ExamViolationsController } from './exam-violations.controller';
import { AdminV1ExamViolationsService } from './exam-violations.service';

@Module({
  controllers: [AdminV1ExamViolationsController],
  providers: [AdminV1ExamViolationsService],
})
export class AdminV1ExamViolationsModule {}
