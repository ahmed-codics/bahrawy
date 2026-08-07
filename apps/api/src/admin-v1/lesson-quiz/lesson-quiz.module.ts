import { Module } from '@nestjs/common';
import { AdminV1LessonQuizController } from './lesson-quiz.controller';
import { AdminV1LessonQuizService } from './lesson-quiz.service';
import { AdminAuditService } from '../common/services/audit.service';

@Module({
  controllers: [AdminV1LessonQuizController],
  providers: [AdminV1LessonQuizService, AdminAuditService],
})
export class AdminV1LessonQuizModule {}
