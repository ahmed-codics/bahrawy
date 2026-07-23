import { Module } from '@nestjs/common';
import { AdminV1QuestionsController } from './questions.controller';
import { AdminV1QuestionsService } from './questions.service';

@Module({
  controllers: [AdminV1QuestionsController],
  providers: [AdminV1QuestionsService],
})
export class AdminV1QuestionsModule {}
