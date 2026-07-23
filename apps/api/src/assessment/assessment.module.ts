import { Module, Global } from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { AssessmentController, AssessmentPlanController } from './assessment.controller';

@Global()
@Module({
  controllers: [AssessmentController, AssessmentPlanController],
  providers: [AssessmentService],
  exports: [AssessmentService],
})
export class AssessmentModule {}
