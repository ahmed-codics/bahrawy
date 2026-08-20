import { Module, Global } from '@nestjs/common';
import { StudentQuestionsService } from './student-questions.service';
import { StudentQuestionsController } from './student-questions.controller';
import { StudentQuestionAttachmentsController } from './student-question-attachments.controller';
import { StudentQuestionAttachmentsService } from './student-questions-attachments.service';

@Global()
@Module({
  controllers: [
    StudentQuestionsController,
    StudentQuestionAttachmentsController,
  ],
  providers: [StudentQuestionsService, StudentQuestionAttachmentsService],
  exports: [StudentQuestionsService, StudentQuestionAttachmentsService],
})
export class StudentQuestionsModule {}
