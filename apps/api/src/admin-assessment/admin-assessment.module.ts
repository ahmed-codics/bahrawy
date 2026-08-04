import { Module } from '@nestjs/common';
import { AdminAssessmentController } from './admin-assessment.controller';
import { AdminAssessmentService } from './admin-assessment.service';

@Module({
  controllers: [AdminAssessmentController],
  providers: [AdminAssessmentService],
})
export class AdminAssessmentModule {}
