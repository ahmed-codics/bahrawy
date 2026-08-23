import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { db } from '@bahrawy/db';
import { SecurityService } from '../security/security.service';
import { NotificationService } from '../notification/notification.service';
import { CatalogService } from '../catalog/catalog.service';
import { VideoAccessService } from './video-access.grants.service';
import { VideoAccessMailerService } from './video-access.mailer';
import { StudentVideoAccessRequestService } from './video-access.service';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    lesson: { findFirst: jest.fn() },
    videoLesson: { findUnique: jest.fn() },
    videoAccessRequest: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    account: { findUnique: jest.fn() },
    studentProfile: { findUnique: jest.fn() },
  };
  return { db: mockDbClient };
});

describe('StudentVideoAccessRequestService', () => {
  let service: StudentVideoAccessRequestService;
  let catalogService: CatalogService;
  let grants: VideoAccessService;

  const account = { id: 'acc-1', organizationId: 'org-1', kind: 'STUDENT' };
  const lessonRow = {
    id: 'lesson-1',
    titleAr: 'درس تجريبي',
    status: 'PUBLISHED',
    unit: {
      chapter: {
        courseId: 'course-1',
        course: { organizationId: 'org-1', titleAr: 'كورس' },
      },
    },
  };
  const videoRow = { id: 'video-1', sourceRef: 'yt-x', provider: 'YOUTUBE' };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentVideoAccessRequestService,
        {
          provide: SecurityService,
          useValue: {
            decrypt: jest.fn().mockReturnValue('student@bahrawy.test'),
          },
        },
        {
          provide: NotificationService,
          useValue: { createForStaff: jest.fn().mockResolvedValue({}) },
        },
        {
          provide: VideoAccessService,
          useValue: {
            findActiveGrant: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: VideoAccessMailerService,
          useValue: {
            notifyAdminsOfNewRequest: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: CatalogService,
          useValue: { canAccessLesson: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<StudentVideoAccessRequestService>(
      StudentVideoAccessRequestService,
    );
    catalogService = module.get<CatalogService>(CatalogService);
    grants = module.get<VideoAccessService>(VideoAccessService);

    (db.lesson.findFirst as jest.Mock).mockResolvedValue(lessonRow);
    (db.videoLesson.findUnique as jest.Mock).mockResolvedValue(videoRow);
    (db.account.findUnique as jest.Mock).mockResolvedValue({
      emailEncrypted: 'enc',
      phoneEncrypted: 'enc2',
    });
    (db.studentProfile.findUnique as jest.Mock).mockResolvedValue({
      displayName: 'طالب تجريبي',
      studentNumber: 123,
    });
    (db.videoAccessRequest.create as jest.Mock).mockResolvedValue({
      id: 'req-1',
      status: 'PENDING',
      requestedAt: new Date(),
    });
  });

  it('rejects non-students', async () => {
    await expect(
      service.create({ ...account, kind: 'STAFF' }, 'session-1', {
        lessonId: 'lesson-1',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the lesson does not exist', async () => {
    (db.lesson.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      service.create(account, 'session-1', { lessonId: 'lesson-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException for a lesson from another org', async () => {
    (db.lesson.findFirst as jest.Mock).mockResolvedValue({
      ...lessonRow,
      unit: {
        chapter: { course: { organizationId: 'org-OTHER' } },
      },
    });
    await expect(
      service.create(account, 'session-1', { lessonId: 'lesson-1' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException for a non-published lesson', async () => {
    (db.lesson.findFirst as jest.Mock).mockResolvedValue({
      ...lessonRow,
      status: 'DRAFT',
    });
    await expect(
      service.create(account, 'session-1', { lessonId: 'lesson-1' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws BadRequestException when the lesson has no video', async () => {
    (db.videoLesson.findUnique as jest.Mock).mockResolvedValue(null);
    await expect(
      service.create(account, 'session-1', { lessonId: 'lesson-1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws ConflictException when the student already has access', async () => {
    (catalogService.canAccessLesson as jest.Mock).mockResolvedValue(true);
    await expect(
      service.create(account, 'session-1', { lessonId: 'lesson-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws LESSON_NOT_REQUESTABLE for quiz/prerequisite gates', async () => {
    const err = new ForbiddenException({
      code: 'LESSON_LOCKED',
      message: 'locked',
    });
    (catalogService.canAccessLesson as jest.Mock).mockRejectedValue(err);
    let caught: any;
    try {
      await service.create(account, 'session-1', { lessonId: 'lesson-1' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(ForbiddenException);
    expect(caught.getResponse().code).toBe('LESSON_NOT_REQUESTABLE');
  });

  it('throws ConflictException when an active grant already exists', async () => {
    (catalogService.canAccessLesson as jest.Mock).mockRejectedValue(
      new ForbiddenException({ code: 'MISSING_ENTITLEMENT', message: 'no' }),
    );
    (grants.findActiveGrant as jest.Mock).mockResolvedValue({ id: 'grant-1' });
    await expect(
      service.create(account, 'session-1', { lessonId: 'lesson-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when a pending request already exists', async () => {
    (catalogService.canAccessLesson as jest.Mock).mockRejectedValue(
      new ForbiddenException({ code: 'MISSING_ENTITLEMENT', message: 'no' }),
    );
    (db.videoAccessRequest.findFirst as jest.Mock).mockResolvedValue({
      id: 'req-existing',
    });
    await expect(
      service.create(account, 'session-1', { lessonId: 'lesson-1' }),
    ).rejects.toThrow(ConflictException);
  });

  it('creates the request and notifies staff + mailer', async () => {
    (catalogService.canAccessLesson as jest.Mock).mockRejectedValue(
      new ForbiddenException({ code: 'MISSING_ENTITLEMENT', message: 'no' }),
    );
    (db.videoAccessRequest.findFirst as jest.Mock).mockResolvedValue(null);
    const result = await service.create(account, 'session-1', {
      lessonId: 'lesson-1',
    });
    expect(db.videoAccessRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        accountId: 'acc-1',
        lessonId: 'lesson-1',
        status: 'PENDING',
        requestedEmail: 'student@bahrawy.test',
      }),
    });
    expect(result).toEqual(
      expect.objectContaining({ id: 'req-1', status: 'PENDING' }),
    );
  });

  it('statusForLesson reports a grantable locked video as requestable', async () => {
    (catalogService.canAccessLesson as jest.Mock).mockRejectedValue(
      new ForbiddenException({ code: 'MISSING_ENTITLEMENT', message: 'no' }),
    );
    (grants.findActiveGrant as jest.Mock).mockResolvedValue(null);
    (db.videoAccessRequest.findFirst as jest.Mock).mockResolvedValue(null);
    const status = await service.statusForLesson(account, 'lesson-1');
    expect(status.requestable).toBe(true);
    expect(status.canPlay).toBe(false);
    expect(status.request).toBeNull();
  });

  it('statusForLesson reports quiz gates as non-requestable', async () => {
    (catalogService.canAccessLesson as jest.Mock).mockRejectedValue(
      new ForbiddenException({ code: 'LESSON_LOCKED', message: 'locked' }),
    );
    const status = await service.statusForLesson(account, 'lesson-1');
    expect(status.requestable).toBe(false);
    expect(status.canPlay).toBe(false);
  });
});
