import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import {
  MAX_IMAGE_SIZE_BYTES,
  StudentQuestionAttachmentsService,
} from './student-questions-attachments.service';
import { db } from '@bahrawy/db';

const mockMetadata = jest.fn();
const mockToFile = jest.fn();
const mockWebp = jest.fn(() => ({ toFile: mockToFile }));
const mockResize = jest.fn(() => ({ webp: mockWebp }));
const mockRotate = jest.fn(() => ({ resize: mockResize }));
jest.mock('sharp', () =>
  jest.fn(() => ({
    metadata: mockMetadata,
    rotate: mockRotate,
  })),
);

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    storedObject: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    studentQuestionAttachment: {
      findFirst: jest.fn(),
    },
  };
  return { db: mockDbClient };
});

const storageMock = {
  computeFileSha256: jest.fn().mockResolvedValue('sha256'),
  registerUpload: jest.fn().mockResolvedValue({
    id: 'obj-1',
    organizationId: 'org-x',
    uploadedBy: 'student-1',
    bucket: 'storage',
    objectKey: 'abc.webp',
    originalName: 'photo.webp',
    mimeType: 'image/webp',
    sizeBytes: 4321,
    scanStatus: 'PENDING',
    status: 'QUARANTINE',
  }),
  markScanResult: jest.fn().mockResolvedValue(undefined),
};
const clamMock = { scanFile: jest.fn().mockResolvedValue('CLEAN') };

describe('StudentQuestionAttachmentsService', () => {
  let service: StudentQuestionAttachmentsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StudentQuestionAttachmentsService(
      storageMock as any,
      clamMock as any,
    );
    mockMetadata.mockResolvedValue({ width: 1200, height: 800 });
    mockToFile.mockResolvedValue(undefined);
  });

  describe('sniffImageMime', () => {
    it('detects JPEG, PNG and WebP from magic bytes', () => {
      const jpeg = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0,
      ]);
      const png = Buffer.from([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
      ]);
      const webp = Buffer.concat([
        Buffer.from('RIFF', 'latin1'),
        Buffer.alloc(4),
        Buffer.from('WEBP', 'latin1'),
      ]);
      expect(service.sniffImageMime(jpeg)).toBe('image/jpeg');
      expect(service.sniffImageMime(png)).toBe('image/png');
      expect(service.sniffImageMime(webp)).toBe('image/webp');
    });

    it('rejects SVG, PDF, ZIP and other non-image files', () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
      const pdf = Buffer.from('%PDF-1.4\n...');
      const zip = Buffer.from('PK\x03\x04...');
      const html = Buffer.from('<!DOCTYPE html><html></html>');
      expect(service.sniffImageMime(svg)).toBeNull();
      expect(service.sniffImageMime(pdf)).toBeNull();
      expect(service.sniffImageMime(zip)).toBeNull();
      expect(service.sniffImageMime(html)).toBeNull();
      expect(service.sniffImageMime(Buffer.alloc(4))).toBeNull();
    });
  });

  describe('upload (server-side validation)', () => {
    const tmpDir = path.join(process.cwd(), '.uploads', 'tmp-test');

    async function makeFile(
      bytes: Buffer,
      size?: number,
    ): Promise<Express.Multer.File> {
      await fs.mkdir(tmpDir, { recursive: true });
      const filePath = path.join(
        tmpDir,
        `up-${Date.now()}-${Math.random().toString(36).slice(2)}.bin`,
      );
      await fs.writeFile(filePath, bytes);
      return {
        path: filePath,
        originalname: 'photo.png',
        mimetype: 'image/png',
        size: size ?? bytes.length,
      } as Express.Multer.File;
    }

    const webpBytes = Buffer.concat([
      Buffer.from('RIFF', 'latin1'),
      Buffer.alloc(4),
      Buffer.from('WEBP', 'latin1'),
      Buffer.alloc(64),
    ]);

    it('rejects when no file is provided', async () => {
      await expect(
        service.upload({ id: 'student-1', organizationId: 'org-x' }, undefined),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a file larger than 5 MB with the Arabic message', async () => {
      const file = await makeFile(webpBytes, MAX_IMAGE_SIZE_BYTES + 1);
      await expect(
        service.upload({ id: 'student-1', organizationId: 'org-x' }, file),
      ).rejects.toMatchObject({
        response: { message: 'حجم الصورة يجب ألا يتجاوز 5 ميجابايت' },
      });
    });

    it('rejects a non-image file by content sniffing', async () => {
      const file = await makeFile(
        Buffer.from('PK\x03\x04 gzip fake payload.....'),
      );
      await expect(
        service.upload({ id: 'student-1', organizationId: 'org-x' }, file),
      ).rejects.toMatchObject({ response: { code: 'INVALID_MIME_TYPE' } });
    });

    it('rejects a file that does not decode as a raster image', async () => {
      mockMetadata.mockRejectedValue(new Error('not an image'));
      const file = await makeFile(webpBytes);
      await expect(
        service.upload({ id: 'student-1', organizationId: 'org-x' }, file),
      ).rejects.toMatchObject({ response: { code: 'INVALID_IMAGE' } });
    });

    it('rejects images with oversized dimensions', async () => {
      mockMetadata.mockResolvedValue({ width: 90000, height: 90000 });
      const file = await makeFile(webpBytes);
      await expect(
        service.upload({ id: 'student-1', organizationId: 'org-x' }, file),
      ).rejects.toThrow(BadRequestException);
      expect(storageMock.registerUpload).not.toHaveBeenCalled();
    });

    it('optimizes, registers and scans a valid image', async () => {
      mockStatSize(4321);
      const file = await makeFile(webpBytes);
      const result = await service.upload(
        { id: 'student-1', organizationId: 'org-x' },
        file,
      );
      expect(result.storedObjectId).toBe('obj-1');
      expect(result.mimeType).toBe('image/webp');
      expect(result.sizeBytes).toBe(4321);
      expect(storageMock.registerUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-x',
          uploadedBy: 'student-1',
          mimeType: 'image/webp',
          sizeBytes: 4321,
          bucket: 'storage',
        }),
      );
      expect(clamMock.scanFile).toHaveBeenCalled();
      expect(storageMock.markScanResult).toHaveBeenCalledWith('obj-1', 'CLEAN');
    });
  });

  describe('sniffAudioMime', () => {
    it('detects WebM, Ogg, MP4 and MP3 from magic bytes', () => {
      const webm = Buffer.concat([
        Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00]),
        Buffer.alloc(8),
      ]);
      const ogg = Buffer.concat([
        Buffer.from('OggS', 'latin1'),
        Buffer.alloc(12),
      ]);
      const mp4 = Buffer.concat([
        Buffer.from([0, 0, 0, 0]),
        Buffer.from('ftypM4A', 'latin1'),
        Buffer.alloc(8),
      ]);
      const mp3 = Buffer.concat([
        Buffer.from('ID3', 'latin1'),
        Buffer.alloc(13),
      ]);
      const mp3sync = Buffer.concat([
        Buffer.from([0xff, 0xfb, 0x90, 0x00, 0x00]),
        Buffer.alloc(11),
      ]);
      expect(service.sniffAudioMime(webm)).toBe('audio/webm');
      expect(service.sniffAudioMime(ogg)).toBe('audio/ogg');
      expect(service.sniffAudioMime(mp4)).toBe('audio/mp4');
      expect(service.sniffAudioMime(mp3)).toBe('audio/mpeg');
      expect(service.sniffAudioMime(mp3sync)).toBe('audio/mpeg');
    });

    it('returns null for short or non-audio buffers', () => {
      expect(service.sniffAudioMime(Buffer.alloc(4))).toBeNull();
      expect(service.sniffAudioMime(Buffer.from('RIFF' + 'fake'))).toBeNull();
    });
  });

  describe('uploadVoice (server-side validation)', () => {
    const tmpDir = path.join(process.cwd(), '.uploads', 'tmp-voice-test');

    async function makeFile(
      bytes: Buffer,
      originalname = 'rec.webm',
      mimetype = 'audio/webm',
    ): Promise<Express.Multer.File> {
      await fs.mkdir(tmpDir, { recursive: true });
      const filePath = path.join(
        tmpDir,
        `upv-${Date.now()}-${Math.random().toString(36).slice(2)}.webm`,
      );
      await fs.writeFile(filePath, bytes);
      return {
        path: filePath,
        originalname,
        mimetype,
        size: bytes.length,
      } as Express.Multer.File;
    }

    const webmBytes = Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3]),
      Buffer.alloc(256),
    ]);

    it('rejects when no file is provided', async () => {
      await expect(
        service.uploadVoice(
          { id: 'student-1', organizationId: 'org-x' },
          undefined,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects a non-audio file by content sniffing', async () => {
      const file = await makeFile(
        Buffer.from('this is not audio, just text bytes here'),
        'evil.txt',
        'text/plain',
      );
      await expect(
        service.uploadVoice({ id: 'student-1', organizationId: 'org-x' }, file),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_MIME_TYPE' },
      });
    });

    it('registers, scans and returns a valid voice recording', async () => {
      const file = await makeFile(webmBytes);
      (storageMock.registerUpload as jest.Mock).mockResolvedValue({
        id: 'voice-1',
      });
      const result = await service.uploadVoice(
        { id: 'student-1', organizationId: 'org-x' },
        file,
      );
      expect(result.mimeType).toBe('audio/webm');
      expect(result.storedObjectId).toBe('voice-1');
      expect(storageMock.registerUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-x',
          uploadedBy: 'student-1',
          mimeType: 'audio/webm',
        }),
      );
      expect(clamMock.scanFile).toHaveBeenCalled();
    });
  });

  describe('resolveAttachments', () => {
    const baseObject = {
      id: 'obj-1',
      organizationId: 'org-x',
      uploadedBy: 'student-1',
      status: 'APPROVED',
      mimeType: 'image/webp',
      originalName: 'photo.webp',
      sizeBytes: 123,
    };

    it('returns an empty array when no ids are given', async () => {
      const result = await service.resolveAttachments(
        'org-x',
        'student-1',
        undefined,
        false,
      );
      expect(result).toEqual([]);
      expect(db.storedObject.findMany).not.toHaveBeenCalled();
    });

    it('rejects more than 3 images', async () => {
      (db.storedObject.findMany as jest.Mock).mockResolvedValue(
        ['a', 'b', 'c', 'd'].map((id, index) => ({
          ...baseObject,
          id,
          originalName: `photo-${index}.webp`,
        })),
      );
      await expect(
        service.resolveAttachments(
          'org-x',
          'student-1',
          ['a', 'b', 'c', 'd'],
          false,
        ),
      ).rejects.toMatchObject({ response: { code: 'TOO_MANY_ATTACHMENTS' } });
    });

    it('rejects references to non-existent objects', async () => {
      (db.storedObject.findMany as jest.Mock).mockResolvedValue([
        { ...baseObject },
      ]);
      await expect(
        service.resolveAttachments(
          'org-x',
          'student-1',
          ['obj-1', 'obj-2'],
          false,
        ),
      ).rejects.toMatchObject({ response: { code: 'INVALID_ATTACHMENT' } });
    });

    it('rejects objects that were not approved', async () => {
      (db.storedObject.findMany as jest.Mock).mockResolvedValue([
        { ...baseObject, status: 'QUARANTINE' },
      ]);
      await expect(
        service.resolveAttachments('org-x', 'student-1', ['obj-1'], false),
      ).rejects.toMatchObject({ response: { code: 'INVALID_ATTACHMENT' } });
    });

    it('rejects non-image objects', async () => {
      (db.storedObject.findMany as jest.Mock).mockResolvedValue([
        { ...baseObject, mimeType: 'application/pdf' },
      ]);
      await expect(
        service.resolveAttachments('org-x', 'student-1', ['obj-1'], false),
      ).rejects.toMatchObject({ response: { code: 'INVALID_ATTACHMENT' } });
    });

    it('rejects an attachment from another organization', async () => {
      (db.storedObject.findMany as jest.Mock).mockResolvedValue([
        { ...baseObject, organizationId: 'org-other' },
      ]);
      await expect(
        service.resolveAttachments('org-x', 'student-1', ['obj-1'], false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a student referencing an attachment they did not upload', async () => {
      (db.storedObject.findMany as jest.Mock).mockResolvedValue([
        { ...baseObject, uploadedBy: 'student-other' },
      ]);
      await expect(
        service.resolveAttachments('org-x', 'student-1', ['obj-1'], false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows a student to reference their own uploaded attachment', async () => {
      (db.storedObject.findMany as jest.Mock).mockResolvedValue([
        { ...baseObject },
      ]);
      const result = await service.resolveAttachments(
        'org-x',
        'student-1',
        ['obj-1'],
        false,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('obj-1');
    });

    it('allows staff to reference staff-uploaded attachments within the org', async () => {
      (db.storedObject.findMany as jest.Mock).mockResolvedValue([
        { ...baseObject, uploadedBy: 'staff-1' },
      ]);
      const result = await service.resolveAttachments(
        'org-x',
        'staff-1',
        ['obj-1'],
        true,
      );
      expect(result).toHaveLength(1);
    });

    it('accepts an audio object as VOICE with its duration', async () => {
      (db.storedObject.findMany as jest.Mock).mockResolvedValue([
        { ...baseObject, mimeType: 'audio/webm', sizeBytes: 2048n },
      ]);
      const result = await service.resolveAttachments(
        'org-x',
        'student-1',
        ['obj-1'],
        false,
        { 'obj-1': 42 },
      );
      expect(result[0].type).toBe('VOICE');
      expect(result[0].durationSeconds).toBe(42);
      expect(result[0].sizeBytes).toBe(2048n);
    });

    it('rejects a second voice when one already exists on the question', async () => {
      (db.storedObject.findMany as jest.Mock).mockResolvedValue([
        { ...baseObject, mimeType: 'audio/webm' },
      ]);
      await expect(
        service.resolveAttachments(
          'org-x',
          'student-1',
          ['obj-1'],
          false,
          { 'obj-1': 10 },
          1,
        ),
      ).rejects.toMatchObject({
        response: { code: 'TOO_MANY_ATTACHMENTS' },
      });
    });

    it('rejects a voice duration out of bounds', async () => {
      (db.storedObject.findMany as jest.Mock).mockResolvedValue([
        { ...baseObject, mimeType: 'audio/webm' },
      ]);
      await expect(
        service.resolveAttachments('org-x', 'student-1', ['obj-1'], false, {
          'obj-1': 0,
        }),
      ).rejects.toMatchObject({ response: { code: 'INVALID_DURATION' } });
    });
  });

  describe('signed URLs', () => {
    it('issues a URL that verifies with the matching token', () => {
      const url = service.signImageUrl(
        'student-1',
        'q-1',
        'att-1',
        '/student/questions',
      );
      const parsed = new URL(url, 'http://localhost');
      expect(parsed.pathname).toBe('/student/questions/q-1/attachments/att-1');
      const account = parsed.searchParams.get('account');
      expect(account).toBe('student-1');
      expect(
        service.verifyImageToken(
          'student-1',
          'q-1',
          'att-1',
          parsed.searchParams.get('expires') || undefined,
          parsed.searchParams.get('token') || undefined,
        ),
      ).toBe(true);
    });

    it('rejects a token when the attachment id is tampered with', () => {
      const url = service.signImageUrl(
        'student-1',
        'q-1',
        'att-1',
        '/student/questions',
      );
      const parsed = new URL(url, 'http://localhost');
      expect(
        service.verifyImageToken(
          'student-1',
          'q-1',
          'att-2',
          parsed.searchParams.get('expires') || undefined,
          parsed.searchParams.get('token') || undefined,
        ),
      ).toBe(false);
    });

    it('rejects an expired token', () => {
      const url = service.signImageUrl(
        'student-1',
        'q-1',
        'att-1',
        '/student/questions',
      );
      const parsed = new URL(url, 'http://localhost');
      expect(
        service.verifyImageToken(
          'student-1',
          'q-1',
          'att-1',
          '1',
          parsed.searchParams.get('token') || undefined,
        ),
      ).toBe(false);
      expect(
        service.verifyImageToken(
          'student-1',
          'q-1',
          'att-1',
          parsed.searchParams.get('expires') || undefined,
          'garbage-token',
        ),
      ).toBe(false);
      expect(
        service.verifyImageToken(
          'student-1',
          'q-1',
          'att-1',
          undefined,
          undefined,
        ),
      ).toBe(false);
    });
  });

  describe('policy', () => {
    it('exposes matching client-side limits', () => {
      const policy = service.getPolicy();
      expect(policy.maxImageCount).toBe(3);
      expect(policy.maxVoiceCount).toBe(1);
      expect(policy.maxVoiceSizeBytes).toBe(10 * 1024 * 1024);
      expect(policy.maxVoiceDurationSeconds).toBe(180);
    });
  });
});

function mockStatSize(size: number) {
  jest.spyOn(fs, 'stat').mockResolvedValue({ size });
}
