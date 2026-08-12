import { Module, Global } from '@nestjs/common';
import { ExamSessionService } from './exam-session.service';
import { ExamSessionController } from './exam-session.controller';

@Global()
@Module({
  controllers: [ExamSessionController],
  providers: [ExamSessionService],
  exports: [ExamSessionService],
})
export class ExamSessionModule {}
