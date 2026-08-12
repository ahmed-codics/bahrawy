import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ExamSessionService, EXAM_LOCK_REASONS } from './exam-session.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';

@Controller('assessments')
@UseGuards(SessionAuthGuard)
export class ExamSessionController {
  constructor(private readonly examSessionService: ExamSessionService) {}

  @Get(':assessmentId/exam-session')
  async latest(@Req() req: any, @Param('assessmentId') assessmentId: string) {
    const data = await this.examSessionService.latestSummary(
      req.account.id,
      assessmentId,
    );
    return { status: 'SUCCESS', data };
  }

  @Get('attempt/:attemptId/exam-session')
  async sessionByAttempt(
    @Req() req: any,
    @Param('attemptId') attemptId: string,
  ) {
    const data = await this.examSessionService.sessionByAttempt(
      req.account.id,
      attemptId,
    );
    if (!data) {
      throw new NotFoundException('جلسة الامتحان غير موجودة أو غير متاحة.');
    }
    return { status: 'SUCCESS', data };
  }

  @Post('attempt/:attemptId/exam-session/violations')
  async reportViolation(
    @Req() req: any,
    @Param('attemptId') attemptId: string,
    @Body() body: { reason?: string },
  ) {
    const reason = (body.reason ?? '').trim();
    if (!EXAM_LOCK_REASONS.includes(reason as any)) {
      throw new BadRequestException({
        code: 'INVALID_VIOLATION_REASON',
        message: 'سبب مخالفة غير معروف.',
      });
    }
    const data = await this.examSessionService.reportViolationForAttempt(
      req.account.id,
      attemptId,
      reason,
    );
    return { status: 'SUCCESS', data };
  }
}
