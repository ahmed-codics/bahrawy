import { db } from '@bahrawy/db';
import { AdminV1CoursesService } from './courses.service';

jest.mock('@bahrawy/db', () => {
  return {
    db: {
      unit: { findFirst: jest.fn() },
      $transaction: jest.fn(),
    },
  };
});

describe('AdminV1CoursesService lesson lifecycle', () => {
  const service = new AdminV1CoursesService();

  beforeEach(() => jest.clearAllMocks());

  it('publishes the lesson container, its content, and its parent chapter', async () => {
    (db.unit.findFirst as jest.Mock).mockResolvedValue({
      id: 'unit-1',
      unitId: 'unit-1',
      chapterId: 'chapter-1',
      version: 3,
      chapter: { id: 'chapter-1', status: 'DRAFT' },
    });
    const tx = {
      chapter: { update: jest.fn() },
      lesson: { updateMany: jest.fn() },
      unit: { update: jest.fn().mockResolvedValue({ id: 'unit-1' }) },
    };
    (db.$transaction as jest.Mock).mockImplementationOnce((callback) =>
      callback(tx),
    );

    await service.updateLessonLifecycle('org-1', 'unit-1', 'PUBLISHED', 3);

    expect(tx.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'chapter-1' },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
    expect(tx.lesson.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { unitId: 'unit-1' },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
    expect(tx.unit.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
  });
});
