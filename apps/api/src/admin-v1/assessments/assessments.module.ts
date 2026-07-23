import { Module } from '@nestjs/common';
import { AdminV1AssessmentsController } from './assessments.controller';
import { AdminV1AssessmentsService } from './assessments.service';

@Module({
  controllers: [AdminV1AssessmentsController],
  providers: [AdminV1AssessmentsService],
})
export class AdminV1AssessmentsModule {}
