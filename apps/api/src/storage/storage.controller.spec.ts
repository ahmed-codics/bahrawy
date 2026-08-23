import { NotFoundException, ForbiddenException } from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { db } from '@bahrawy/db';
import { StorageController } from './storage.controller';

jest.mock('@bahrawy/db', () => ({
  db: {
    course: { count: jest.fn() },
    product: { count: jest.fn() },
    lesson: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  createReadStream: jest.fn(),
}));

describe('StorageController public covers', () => {
  const storageService = {
    getApprovedObject: jest.fn(),
  };
  const clamAvService = {};
  const catalogService = {
    getUnitAccess: jest.fn(),
    canAccessLesson: jest.fn(),
  };
  const response = {
    setHeader: jest.fn(),
  } as unknown as Response;
  const pipe = jest.fn();
  const controller = new StorageController(
    storageService as never,
    clamAvService as never,
    catalogService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.createReadStream as jest.Mock).mockReturnValue({ pipe });
  });

  it('streams an approved image used by a published product', async () => {
    storageService.getApprovedObject.mockResolvedValue({
      id: 'cover-1',
      mimeType: 'image/webp',
      objectKey: 'cover.webp',
      originalName: 'bundle.webp',
    });
    (db.$transaction as jest.Mock).mockResolvedValue([0, 1]);

    await controller.getPublicCover('cover-1', response);

    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'image/webp',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=604800',
    );
    expect(pipe).toHaveBeenCalledWith(response);
  });

  it('does not expose an image that is not referenced by published content', async () => {
    storageService.getApprovedObject.mockResolvedValue({
      id: 'private-image',
      mimeType: 'image/png',
      objectKey: 'private.png',
      originalName: 'private.png',
    });
    (db.$transaction as jest.Mock).mockResolvedValue([0, 0]);

    await expect(
      controller.getPublicCover('private-image', response),
    ).rejects.toThrow(NotFoundException);
    expect(fs.createReadStream).not.toHaveBeenCalled();
  });

  it('does not expose approved non-image uploads', async () => {
    storageService.getApprovedObject.mockResolvedValue({
      id: 'document-1',
      mimeType: 'application/pdf',
      objectKey: 'notes.pdf',
      originalName: 'notes.pdf',
    });

    await expect(
      controller.getPublicCover('document-1', response),
    ).rejects.toThrow(NotFoundException);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('streams a lesson PDF when the student owns that lesson', async () => {
    storageService.getApprovedObject.mockResolvedValue({
      id: 'pdf-1',
      organizationId: 'org-1',
      uploadedBy: 'staff-1',
      mimeType: 'application/pdf',
      objectKey: 'lesson.pdf',
      originalName: 'lesson.pdf',
    });
    (db.$transaction as jest.Mock).mockResolvedValue([0, 0]);
    (db.lesson.findFirst as jest.Mock).mockResolvedValue({ id: 'lesson-1' });
    catalogService.canAccessLesson.mockResolvedValue(true);

    await controller.getStoredObject(
      {
        account: {
          id: 'student-1',
          kind: 'STUDENT',
          organizationId: 'org-1',
        },
      },
      'pdf-1',
      response,
    );

    expect(catalogService.canAccessLesson).toHaveBeenCalledWith(
      'student-1',
      'lesson-1',
    );
    expect(response.setHeader).toHaveBeenCalledWith(
      'Content-Type',
      'application/pdf',
    );
    expect(pipe).toHaveBeenCalledWith(response);
  });
});

import { createHmac } from 'crypto';
describe('StorageController Signed URLs', () => {
  const storageService = { getApprovedObject: jest.fn() };
  const clamAvService = {};
  const catalogService = { canAccessLesson: jest.fn(), getUnitAccess: jest.fn() };
  const response = { setHeader: jest.fn() } as unknown as Response;
  const pipe = jest.fn();
  
  const controller = new StorageController(
    storageService as never,
    clamAvService as never,
    catalogService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.createReadStream as jest.Mock).mockReturnValue({ pipe });
    process.env.COOKIE_SECRET = 'test-secret';
  });

  it('generates a signed URL for an authorized student', async () => {
    storageService.getApprovedObject.mockResolvedValue({
      id: 'pdf-1',
      organizationId: 'org-1',
      uploadedBy: 'staff-1',
    });
    (db.$transaction as jest.Mock).mockResolvedValue([0, 0]);
    (db.lesson.findFirst as jest.Mock).mockResolvedValue({ id: 'lesson-1' });
    catalogService.canAccessLesson.mockResolvedValue(true);

    const result = await controller.getSignedUrl({
      account: { id: 'student-1', kind: 'STUDENT', organizationId: 'org-1' }
    }, 'pdf-1');

    expect(result.status).toBe('SUCCESS');
    expect(result.data.url).toContain('/storage/pdf-1/signed?account=student-1&exp=');
    expect(result.data.url).toContain('&sig=');
  });

  it('allows access to signed URL with valid signature', async () => {
    storageService.getApprovedObject.mockResolvedValue({
      id: 'pdf-1',
      mimeType: 'application/pdf',
      objectKey: 'file.pdf',
      originalName: 'file.pdf',
    });

    const exp = Math.floor(Date.now() / 1000) + 3600;
    const sig = createHmac('sha256', 'test-secret')
      .update(`pdf-1:student-1:${exp}`)
      .digest('hex');

    await controller.accessSignedUrl('pdf-1', {
      query: { account: 'student-1', exp, sig }
    } as any, response);

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(pipe).toHaveBeenCalledWith(response);
  });

  it('rejects access to signed URL with invalid signature', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    await expect(async () => await controller.accessSignedUrl('pdf-1', {
      query: { account: 'student-1', exp, sig: 'invalid-sig' }
    } as any, response)).rejects.toThrow(ForbiddenException);
  });
});

