import { Module } from '@nestjs/common';
import { AdminV1ExamResultsController } from './exam-results.controller';
import { AdminV1ExamResultsService } from './exam-results.service';

@Module({
  controllers: [AdminV1ExamResultsController],
  providers: [AdminV1ExamResultsService],
})
export class AdminV1ExamResultsModule {}
