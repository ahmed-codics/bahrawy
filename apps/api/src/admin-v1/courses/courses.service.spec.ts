import { db } from '@bahrawy/db';
import { AdminV1CoursesService } from './courses.service';

jest.mock('@bahrawy/db', () => {
  return {
    db: {
      unit: { findFirst: jest.fn() },
      course: { findFirst: jest.fn() },
      lesson: { findFirst: jest.fn(), findUnique: jest.fn() },
      assessmentAttempt: { count: jest.fn() },
      lessonProgress: { count: jest.fn() },
      entitlement: { count: jest.fn() },
      paymentOrder: { count: jest.fn() },
      $transaction: jest.fn(),
    },
  };
});

describe('AdminV1CoursesService lesson lifecycle', () => {
  const audit = {
    logEvent: jest.fn(),
  };
  const service = new AdminV1CoursesService(audit as never);

  beforeEach(() => {
    jest.clearAllMocks();
    audit.logEvent.mockResolvedValue(undefined);
  });

  it('publishes the lesson container, its content, and its parent chapter', async () => {
    (db.unit.findFirst as jest.Mock).mockResolvedValue({
      id: 'unit-1',
      unitId: 'unit-1',
      chapterId: 'chapter-1',
      version: 3,
      chapter: { id: 'chapter-1', courseId: 'course-1', status: 'DRAFT' },
    });
    const tx = {
      course: { updateMany: jest.fn() },
      chapter: { update: jest.fn() },
      lesson: { updateMany: jest.fn() },
      unit: { update: jest.fn().mockResolvedValue({ id: 'unit-1' }) },
    };
    (db.$transaction as jest.Mock).mockImplementationOnce((callback) =>
      callback(tx),
    );

    await service.updateLessonLifecycle(
      { id: 'staff-1', organizationId: 'org-1' },
      'unit-1',
      'PUBLISHED',
      3,
    );

    expect(tx.chapter.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'chapter-1' },
        data: expect.objectContaining({ status: 'PUBLISHED' }),
      }),
    );
    expect(tx.course.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'course-1' }),
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
    expect(audit.logEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        actorId: 'staff-1',
        targetId: 'unit-1',
      }),
    );
  });

  it('publishes the lesson ancestors when the lesson editor publishes content', async () => {
    (db.lesson.findFirst as jest.Mock).mockResolvedValue({
      id: 'lesson-1',
      version: 2,
      titleAr: 'فيديو شرح',
    });
    (db.lesson.findUnique as jest.Mock).mockResolvedValue({
      id: 'lesson-1',
      unitId: 'unit-1',
      unit: {
        chapterId: 'chapter-1',
        chapter: { id: 'chapter-1', courseId: 'course-1' },
      },
    });
    const tx = {
      course: { updateMany: jest.fn() },
      chapter: { updateMany: jest.fn() },
      unit: { updateMany: jest.fn() },
      lesson: {
        update: jest.fn().mockResolvedValue({
          id: 'lesson-1',
          status: 'PUBLISHED',
        }),
      },
    };
    (db.$transaction as jest.Mock).mockImplementationOnce((callback) =>
      callback(tx),
    );

    await service.updateNode(
      { id: 'staff-1', organizationId: 'org-1' },
      'lesson',
      'lesson-1',
      {
        version: 2,
        titleAr: 'فيديو شرح',
        status: 'PUBLISHED',
      },
    );

    expect(tx.course.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'course-1' }),
      }),
    );
    expect(tx.chapter.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'chapter-1' }),
      }),
    );
    expect(tx.unit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'unit-1' }),
      }),
    );
    expect(tx.lesson.update).toHaveBeenCalled();
  });

  it('blocks permanent course deletion while a product or bundle references it', async () => {
    (db.course.findFirst as jest.Mock).mockResolvedValue({
      id: 'course-1',
      titleAr: 'كورس تجريبي',
      status: 'DRAFT',
      chapters: [],
      products: [{ productId: 'product-1' }],
      _count: {
        assessments: 0,
        prerequisites: 0,
        prerequisiteFor: 0,
      },
    });
    (db.assessmentAttempt.count as jest.Mock).mockResolvedValue(0);
    (db.entitlement.count as jest.Mock).mockResolvedValue(0);
    (db.paymentOrder.count as jest.Mock).mockResolvedValue(0);

    const impact = await service.deletionImpact('org-1', 'course-1');

    expect(impact.actions).toEqual(['ARCHIVE']);
    expect(impact.blockers).toContainEqual({
      code: 'PRODUCT_MEMBERSHIPS',
      label: 'منتجات أو باقات مرتبطة بالكورس',
      count: 1,
    });
  });
});
