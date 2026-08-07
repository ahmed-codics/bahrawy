import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AssessmentService } from './assessment.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { db } from '@bahrawy/db';

@Controller('assessments')
@UseGuards(SessionAuthGuard)
export class AssessmentController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get('course/:courseId')
  async listAssessments(@Req() req: any, @Param('courseId') courseId: string) {
    const data = await this.assessmentService.listAssessments(
      req.account.id,
      courseId,
    );
    return { status: 'SUCCESS', data };
  }

  @Post(':assessmentId/start')
  async startAttempt(
    @Req() req: any,
    @Param('assessmentId') assessmentId: string,
    @Body() body: { newAttempt?: boolean } = {},
  ) {
    const data = await this.assessmentService.startAttempt(
      req.account.id,
      assessmentId,
      body.newAttempt === true,
    );
    return { status: 'SUCCESS', data };
  }

  @Get('attempt/:attemptId')
  async getCurrentAttempt(
    @Req() req: any,
    @Param('attemptId') attemptId: string,
  ) {
    const data = await this.assessmentService.getCurrentAttempt(
      req.account.id,
      attemptId,
    );
    return { status: 'SUCCESS', data };
  }

  @Post('attempt/:attemptId/autosave')
  async autosaveAnswers(
    @Req() req: any,
    @Param('attemptId') attemptId: string,
    @Body() body: { answers: Record<string, string> },
  ) {
    const data = await this.assessmentService.autosaveAnswers(
      req.account.id,
      attemptId,
      body.answers,
    );
    return { status: 'SUCCESS', data };
  }

  @Post('attempt/:attemptId/submit')
  async submitAttempt(@Req() req: any, @Param('attemptId') attemptId: string) {
    const data = await this.assessmentService.submitAttempt(
      req.account.id,
      attemptId,
    );
    return { status: 'SUCCESS', data };
  }
}

@Controller('assessment')
@UseGuards(SessionAuthGuard)
export class AssessmentPlanController {
  constructor(private readonly assessmentService: AssessmentService) {}

  @Get(':assessmentId')
  async getAssessment(
    @Req() req: any,
    @Param('assessmentId') assessmentId: string,
  ) {
    const attempt = await this.assessmentService.startAttempt(
      req.account.id,
      assessmentId,
    );
    const data = await this.assessmentService.getCurrentAttempt(
      req.account.id,
      attempt.id,
    );
    return { status: 'SUCCESS', data };
  }

  @Post(':assessmentId/submit')
  async submitAnswers(
    @Req() req: any,
    @Param('assessmentId') assessmentId: string,
    @Body()
    body: {
      answers:
        | Record<string, string>
        | Array<{ questionId: string; optionId: string }>;
    },
  ) {
    const answerMap = Array.isArray(body.answers)
      ? Object.fromEntries(
          body.answers.map((answer) => [answer.questionId, answer.optionId]),
        )
      : body.answers || {};
    const attempt = await this.assessmentService.startAttempt(
      req.account.id,
      assessmentId,
      true,
    );
    await this.assessmentService.autosaveAnswers(
      req.account.id,
      attempt.id,
      answerMap,
    );
    const submitted = await this.assessmentService.submitAttempt(
      req.account.id,
      attempt.id,
    );

    // Answer keys are sourced ONLY from the service's gated output. The service
    // exposes correctOptionId/explanation on questions solely when the
    // assessment's result-release policy allows it (IMMEDIATE). For deferred
    // release these fields are absent, so nothing below ever echoes an answer
    // key the policy has not explicitly released.
    const releasedQuestions: any[] =
      (submitted?.assessment?.questions as any[] | undefined) ?? [];
    const correctAnswers = submitted.resultsReleased
      ? releasedQuestions
          .map((item: any) => ({
            questionId: item.questionId,
            correctOptionId: item.question?.correctOptionId,
            explanation: item.question?.explanation,
          }))
          .filter((x) => x.correctOptionId !== undefined)
      : [];

    return {
      status: 'SUCCESS',
      data: {
        attempt: submitted,
        score: submitted.score,
        correctAnswers,
      },
    };
  }

  @Get(':assessmentId/results')
  async getResults(
    @Req() req: any,
    @Param('assessmentId') assessmentId: string,
  ) {
    // Results are always scoped to the authenticated account, so a student can
    // only ever read their own attempt history. Only a lean projection is
    // returned: no autosavedAnswers, and never any correctOptionId/explanation
    // /answer-key data. Whether correct answers are revealed individually is
    // governed solely by the attempt/submit endpoints, which respect
    // resultReleaseRule.
    const attempts = await db.assessmentAttempt.findMany({
      where: {
        assessmentId,
        accountId: req.account.id,
        submittedAt: { not: null },
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        score: true,
        resultsReleased: true,
        submittedAt: true,
      },
    });
    const assessment = await db.assessment.findUnique({
      where: { id: assessmentId },
      select: { passingScore: true },
    });
    const passingScore = assessment?.passingScore ?? null;
    const data = attempts.map((attempt) => ({
      id: attempt.id,
      score: attempt.score,
      resultsReleased: attempt.resultsReleased,
      submittedAt: attempt.submittedAt,
      passed:
        passingScore === null || attempt.score === null
          ? null
          : Number(attempt.score) >= passingScore,
    }));
    return { status: 'SUCCESS', data };
  }
}
