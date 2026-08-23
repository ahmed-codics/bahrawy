import { ForbiddenException } from '@nestjs/common';
import { db } from '@bahrawy/db';
import { CatalogService } from './catalog.service';

jest.mock('@bahrawy/db', () => ({
  db: {
    studentProfile: { findUnique: jest.fn() },
    course: { findUnique: jest.fn(), findMany: jest.fn() }, productCourse: { findMany: jest.fn().mockResolvedValue([]) }, product: { findMany: jest.fn().mockResolvedValue([]) }, enrollment: { findMany: jest.fn().mockResolvedValue([]) }, chapter: { findMany: jest.fn().mockResolvedValue([]) }
  }
}));

describe('CatalogService Grade Filtering', () => {
  let service: CatalogService;
  beforeEach(() => {
    service = new CatalogService();
    jest.clearAllMocks();
  });

  describe('getCourseDetail', () => {
    it('rejects access if course grade does not match student grade', async () => {
      (db.studentProfile.findUnique as jest.Mock).mockResolvedValue({ gradeId: 'grade-1' });
      (db.course.findUnique as jest.Mock).mockImplementation((args) => {
        if (args.select?.gradeId) return Promise.resolve({ gradeId: 'grade-2' });
        return Promise.resolve(null);
      });

      await expect(service.getCourseDetail('course-1', 'student-1')).rejects.toThrow(ForbiddenException);
    });

    it('allows access if course grade matches student grade', async () => {
      (db.studentProfile.findUnique as jest.Mock).mockResolvedValue({ gradeId: 'grade-1' });
      (db.course.findUnique as jest.Mock).mockImplementation((args) => {
        if (args.select?.gradeId) return Promise.resolve({ gradeId: 'grade-1' });
        return Promise.resolve({ id: 'course-1', chapters: [], products: [] });
      });

      const result = await service.getCourseDetail('course-1', 'student-1');
      expect(result.course.id).toEqual('course-1');
    });

    it('allows access if course has no grade assigned', async () => {
      (db.studentProfile.findUnique as jest.Mock).mockResolvedValue({ gradeId: 'grade-1' });
      (db.course.findUnique as jest.Mock).mockImplementation((args) => {
        if (args.select?.gradeId) return Promise.resolve({ gradeId: null });
        return Promise.resolve({ id: 'course-1', chapters: [], products: [] });
      });

      const result = await service.getCourseDetail('course-1', 'student-1');
      expect(result.course.id).toEqual('course-1');
    });
  });
});
