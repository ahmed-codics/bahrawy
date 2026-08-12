import { ConflictException } from '@nestjs/common';
import { ExamSessionService } from './exam-session.service';

jest.mock('@bahrawy/db', () => ({
  db: {
    examGrant: {
      create: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { db } from '@bahrawy/db';

const service = new ExamSessionService();
const actor = { id: 'staff-1', organizationId: 'org-1', kind: 'STAFF' };

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ExamSessionService admin-unlock grants', () => {
  it('createGrant persists a one-time grant scoped to the student + assessment', async () => {
    (db.examGrant.create as jest.Mock).mockResolvedValue({ id: 'grant-1' });

    const grant = await service.createGrant(actor, 'account-1', 'assessment-1');

    expect(grant).toEqual({ id: 'grant-1' });
    expect(db.examGrant.create).toHaveBeenCalledWith({
      data: {
        accountId: 'account-1',
        assessmentId: 'assessment-1',
        createdBy: 'staff-1',
        reason: 'ADMIN_UNLOCK',
      },
      select: { id: true, accountId: true, assessmentId: true },
    });
  });

  it('availableGrants counts only unused grants for that exact student + assessment', async () => {
    (db.examGrant.count as jest.Mock).mockResolvedValue(1);

    const count = await service.availableGrants('account-1', 'assessment-1');

    expect(count).toBe(1);
    expect(db.examGrant.count).toHaveBeenCalledWith({
      where: {
        accountId: 'account-1',
        assessmentId: 'assessment-1',
        usedAt: null,
        usedAttemptId: null,
      },
    });
  });

  it('consumeGrant binds the oldest unused grant to the new attempt', async () => {
    (db.examGrant.findFirst as jest.Mock).mockResolvedValue({ id: 'grant-1' });
    (db.examGrant.update as jest.Mock).mockResolvedValue({ id: 'grant-1' });

    await service.consumeGrant('account-1', 'assessment-1', 'attempt-9');

    // Must only ever look at grants belonging to THIS student + assessment.
    expect(db.examGrant.findFirst).toHaveBeenCalledWith({
      where: {
        accountId: 'account-1',
        assessmentId: 'assessment-1',
        usedAt: null,
        usedAttemptId: null,
      },
      orderBy: { createdAt: 'asc' },
    });
    const updateArg = (db.examGrant.update as jest.Mock).mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'grant-1' });
    expect(updateArg.data.usedAttemptId).toBe('attempt-9');
    expect(updateArg.data.usedAt).toBeInstanceOf(Date);
  });

  it('consumeGrant throws NO_EXAM_GRANT when the student has no active grant', async () => {
    (db.examGrant.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.consumeGrant('account-1', 'assessment-1', 'attempt-9'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.examGrant.update).not.toHaveBeenCalled();
  });

  it('another student cannot consume a grant issued for a different student', async () => {
    // The DB filter is keyed on accountId, so a different student finds nothing.
    (db.examGrant.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.consumeGrant('account-OTHER', 'assessment-1', 'attempt-x'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.examGrant.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ accountId: 'account-OTHER' }),
      }),
    );
  });
});
