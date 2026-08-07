import { AssessmentPlanController } from './assessment.controller';
import { AssessmentService } from './assessment.service';
import { NotFoundException } from '@nestjs/common';
import { db } from '@bahrawy/db';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    assessmentAttempt: {
      findMany: jest.fn(),
    },
    assessment: {
      findUnique: jest.fn(),
    },
  };
  return { db: mockDbClient };
});

describe('AssessmentPlanController.submitAnswers (answer-key gate)', () => {
  let controller: AssessmentPlanController;
  let service: AssessmentService;

  beforeEach(() => {
    service = {
      startAttempt: jest.fn(),
      autosaveAnswers: jest.fn(),
      submitAttempt: jest.fn(),
    } as any;
    controller = new AssessmentPlanController(service);
  });

  const req = (accountId = 'acc-1') => ({ account: { id: accountId } });

  it('returns the answer key when results are released immediately', async () => {
    (service.startAttempt as jest.Mock).mockResolvedValue({ id: 'att-1' });
    (service.autosaveAnswers as jest.Mock).mockResolvedValue({});
    (service.submitAttempt as jest.Mock).mockResolvedValue({
      id: 'att-1',
      score: 100,
      resultsReleased: true,
      assessment: {
        questions: [
          {
            questionId: 'q-1',
            question: { correctOptionId: 'option-a', explanation: 'ex-a' },
          },
        ],
      },
    });

    const res = await controller.submitAnswers(req(), 'assess-1', {
      answers: { 'q-1': 'option-a' },
    });

    expect(res.data.correctAnswers).toEqual([
      {
        questionId: 'q-1',
        correctOptionId: 'option-a',
        explanation: 'ex-a',
      },
    ]);
  });

  it('never returns the answer key when result release is deferred', async () => {
    (service.startAttempt as jest.Mock).mockResolvedValue({ id: 'att-1' });
    (service.autosaveAnswers as jest.Mock).mockResolvedValue({});
    (service.submitAttempt as jest.Mock).mockResolvedValue({
      id: 'att-1',
      score: 50,
      resultsReleased: false,
      assessment: {
        questions: [
          {
            questionId: 'q-1',
            // Defense-in-depth: even if the service leaked an answer here, the
            // controller must not echo it for a deferred release.
            question: { correctOptionId: 'option-a', explanation: 'ex-a' },
          },
        ],
      },
    });

    const res = await controller.submitAnswers(req(), 'assess-1', {
      answers: { 'q-1': 'option-b' },
    });

    expect(res.data.correctAnswers).toEqual([]);
  });

  it('forwards the caller account id so cross-student attempts are rejected', async () => {
    (service.startAttempt as jest.Mock).mockResolvedValue({ id: 'att-1' });
    (service.autosaveAnswers as jest.Mock).mockResolvedValue({});
    const error = new NotFoundException();
    (service.submitAttempt as jest.Mock).mockRejectedValue(error);

    await expect(
      controller.submitAnswers(req('acc-2'), 'assess-1', { answers: {} }),
    ).rejects.toThrow(error);
    expect(service.submitAttempt).toHaveBeenCalledWith('acc-2', 'att-1');
  });
});

describe('AssessmentPlanController.getResults (confidential results)', () => {
  let controller: AssessmentPlanController;
  let service: AssessmentService;

  beforeEach(() => {
    service = {
      startAttempt: jest.fn(),
      autosaveAnswers: jest.fn(),
      submitAttempt: jest.fn(),
    } as any;
    controller = new AssessmentPlanController(service);
  });

  afterEach(() => jest.clearAllMocks());

  const req = (accountId: string) => ({ account: { id: accountId } });

  it('returns only a safe, account-scoped projection (no answers/autosavedAnswers)', async () => {
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'att-1',
        assessmentId: 'assess-1',
        accountId: 'acc-1',
        score: 80,
        resultsReleased: false,
        submittedAt: new Date('2026-08-01T00:00:00Z'),
        // These sensitive fields should never reach the client through this route.
        autosavedAnswers: { 'q-1': 'option-a' },
        startedAt: new Date(),
        expiresAt: null,
      },
    ]);
    (db.assessment.findUnique as jest.Mock).mockResolvedValue({
      id: 'assess-1',
      passingScore: 60,
    });

    const res = await controller.getResults(req('acc-1'), 'assess-1');

    expect(db.assessmentAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          assessmentId: 'assess-1',
          accountId: 'acc-1',
          submittedAt: { not: null },
        },
        select: expect.objectContaining({
          id: true,
          score: true,
          resultsReleased: true,
          submittedAt: true,
        }),
      }),
    );

    const row = res.data[0];
    expect(row).not.toHaveProperty('autosavedAnswers');
    expect(row).not.toHaveProperty('correctOptionId');
    expect(row).not.toHaveProperty('explanation');
    expect(row).not.toHaveProperty('startedAt');
    expect(row).toEqual(
      expect.objectContaining({
        id: 'att-1',
        score: 80,
        resultsReleased: false,
        submittedAt: expect.any(Date),
        passed: true,
      }),
    );
  });

  it('queries only the calling student so another student results are inaccessible', async () => {
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([]);
    (db.assessment.findUnique as jest.Mock).mockResolvedValue({
      passingScore: 60,
    });

    await controller.getResults(req('acc-B'), 'assess-1');

    expect(db.assessmentAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: 'acc-B' }),
      }),
    );
  });

  it('marks passed as null when passingScore is not configured', async () => {
    (db.assessmentAttempt.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'att-1',
        score: 100,
        resultsReleased: false,
        submittedAt: new Date(),
      },
    ]);
    (db.assessment.findUnique as jest.Mock).mockResolvedValue({
      passingScore: null,
    });

    const res = await controller.getResults(req('acc-1'), 'assess-1');

    expect(res.data[0].passed).toBeNull();
  });
});
