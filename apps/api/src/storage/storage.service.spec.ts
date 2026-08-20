import { Test, TestingModule } from '@nestjs/testing';
import { StorageService, ClamAvService } from './storage.service';
import { db } from '@bahrawy/db';
import { BadRequestException } from '@nestjs/common';

jest.mock('@bahrawy/db', () => {
  const mockDbClient: any = {
    storedObject: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  return { db: mockDbClient };
});

describe('StorageService', () => {
  let service: StorageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StorageService, ClamAvService],
    }).compile();
    service = module.get<StorageService>(StorageService);
  });

  afterEach(() => jest.clearAllMocks());

  describe('validateMimeAndSize', () => {
    it('should pass for a valid PDF under size limit', () => {
      expect(() =>
        service.validateMimeAndSize('application/pdf', 1024 * 1024, 'test.pdf'),
      ).not.toThrow();
    });

    it('should reject an unknown MIME type', () => {
      expect(() =>
        service.validateMimeAndSize('application/zip', 1024, 'archive.zip'),
      ).toThrow(BadRequestException);
    });

    it('should reject a file over 500 MB', () => {
      expect(() =>
        service.validateMimeAndSize(
          'image/jpeg',
          600 * 1024 * 1024,
          'large.jpg',
        ),
      ).toThrow(BadRequestException);
    });
  });

  describe('computeSha256', () => {
    it('should return a 64-char hex string for a buffer', () => {
      const hash = service.computeSha256(Buffer.from('hello'));
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('markScanResult', () => {
    it('should set status to APPROVED for CLEAN', async () => {
      (db.storedObject.update as jest.Mock).mockResolvedValue({});
      await service.markScanResult('obj-1', 'CLEAN');
      expect(db.storedObject.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scanStatus: 'CLEAN',
            status: 'APPROVED',
          }),
        }),
      );
    });

    it('should set status to QUARANTINE for INFECTED', async () => {
      (db.storedObject.update as jest.Mock).mockResolvedValue({});
      await service.markScanResult('obj-2', 'INFECTED');
      expect(db.storedObject.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            scanStatus: 'INFECTED',
            status: 'QUARANTINE',
          }),
        }),
      );
    });
  });

  describe('getApprovedObject', () => {
    it('should return the object when APPROVED', async () => {
      (db.storedObject.findFirst as jest.Mock).mockResolvedValue({
        id: 'obj-1',
        status: 'APPROVED',
      });
      const obj = await service.getApprovedObject('obj-1');
      expect(obj).toBeDefined();
    });

    it('should throw when object not found or not APPROVED', async () => {
      (db.storedObject.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.getApprovedObject('obj-missing')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('optimizeImageFile', () => {
    it('should convert a JPEG upload to WebP and return updated mime type', async () => {
      const tmpDir = require('node:os').tmpdir();
      const input = `${tmpDir}/optimize-test-${Date.now()}.jpg`;
      const fs = require('node:fs');
      const sharp = require('sharp');
      await sharp({
        create: {
          width: 16,
          height: 16,
          channels: 3,
          background: { r: 30, g: 90, b: 200 },
        },
      })
        .jpeg()
        .toFile(input);
      const result = await service.optimizeImageFile(input, 'image/jpeg');
      expect(result.mimeType).toBe('image/webp');
      expect(result.sizeBytes).toBeGreaterThan(0);
      const meta = await sharp(input).metadata();
      expect(meta.format).toBe('webp');
      fs.unlinkSync(input);
    });

    it('should keep non-image uploads untouched', async () => {
      const tmpDir = require('node:os').tmpdir();
      const input = `${tmpDir}/optimize-test-pdf-${Date.now()}.pdf`;
      const fs = require('node:fs');
      fs.writeFileSync(input, '%PDF-1.4 fake');
      const result = await service.optimizeImageFile(input, 'application/pdf');
      expect(result.mimeType).toBe('application/pdf');
      fs.unlinkSync(input);
    });
  });
});

describe('ClamAvService', () => {
  let clamav: ClamAvService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ClamAvService],
    }).compile();
    clamav = module.get<ClamAvService>(ClamAvService);
  });

  it('should return CLEAN when CLAMAV_ENABLED is not set', async () => {
    delete process.env.CLAMAV_ENABLED;
    const result = await clamav.scanFile('/tmp/test', 'obj-1');
    expect(result).toBe('CLEAN');
  });
});
