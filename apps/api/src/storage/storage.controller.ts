import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { ClamAvService, StorageService } from './storage.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { db } from '@bahrawy/db';
import { CatalogService } from '../catalog/catalog.service';

@Controller('storage')
export class StorageController {
  constructor(
    private readonly storageService: StorageService,
    private readonly clamAvService: ClamAvService,
    private readonly catalogService: CatalogService,
  ) {}

  @Post('upload')
  @UseGuards(SessionAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: path.join(process.cwd(), '.uploads', 'tmp'),
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
        },
      }),
    }),
  )
  async uploadFile(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const tempFile = file.path;
    let finalPath: string | undefined;

    try {
      this.storageService.validateMimeAndSize(
        file.mimetype,
        file.size,
        file.originalname,
      );

      const orgId =
        req.account.organizationId ??
        (await db.organization.findFirst({ select: { id: true } }))?.id;
      if (!orgId) {
        throw new BadRequestException('Organization is not configured');
      }

      const objectKey = `${randomUUID()}-${file.originalname}`;
      const uploadDir = path.join(process.cwd(), '.uploads', 'storage');
      fs.mkdirSync(uploadDir, { recursive: true });
      finalPath = path.join(uploadDir, objectKey);
      fs.renameSync(tempFile, finalPath);

      const sha256 = await this.storageService.computeFileSha256(finalPath);

      const storedObject = await this.storageService.registerUpload({
        organizationId: orgId,
        uploadedBy: req.account.id,
        bucket: 'storage',
        objectKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        sha256,
      });

      const scanResult = await this.clamAvService.scanFile(
        finalPath,
        storedObject.id,
      );
      await this.storageService.markScanResult(storedObject.id, scanResult);

      return {
        status: 'SUCCESS',
        data: { storedObjectId: storedObject.id, scanStatus: scanResult },
      };
    } catch (error) {
      if (finalPath) {
        try {
          fs.unlinkSync(finalPath);
        } catch {
          /* ignore */
        }
      }
      throw error;
    } finally {
      try {
        fs.unlinkSync(tempFile);
      } catch {
        /* temp already renamed or never existed */
      }
    }
  }

  @Get('public/:id')
  async getPublicCover(@Param('id') id: string, @Res() res: Response) {
    const obj = await this.storageService.getApprovedObject(id);
    if (!obj.mimeType.startsWith('image/')) {
      throw new NotFoundException('Cover image not found');
    }

    const coverUrl = `/storage/${id}`;
    const [publishedCourses, publishedProducts] = await db.$transaction([
      db.course.count({
        where: { coverImageUrl: coverUrl, status: 'PUBLISHED' },
      }),
      db.product.count({
        where: {
          coverImageUrl: coverUrl,
          status: { in: ['ACTIVE', 'PUBLISHED'] },
        },
      }),
    ]);
    if (publishedCourses === 0 && publishedProducts === 0) {
      throw new NotFoundException('Cover image not found');
    }

    const filePath = path.join(
      process.cwd(),
      '.uploads',
      'storage',
      obj.objectKey,
    );
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Cover image not found');
    }

    res.setHeader('Content-Type', obj.mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader(
      'Cache-Control',
      'public, max-age=86400, stale-while-revalidate=604800',
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    fs.createReadStream(filePath).pipe(res);
  }

  @Get(':id')
  @UseGuards(SessionAuthGuard)
  async getStoredObject(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const obj = await this.storageService.getApprovedObject(id);
    if (req.account.kind !== 'STAFF' && obj.uploadedBy !== req.account.id) {
      const sharedCover = await db.$transaction([
        db.course.count({
          where: {
            organizationId: req.account.organizationId,
            coverImageUrl: `/storage/${id}`,
            status: 'PUBLISHED',
          },
        }),
        db.product.count({
          where: {
            organizationId: req.account.organizationId,
            coverImageUrl: `/storage/${id}`,
            status: { in: ['ACTIVE', 'PUBLISHED'] },
          },
        }),
      ]);
      if (sharedCover[0] === 0 && sharedCover[1] === 0) {
        const references = [id, `/storage/${id}`];
        const lesson = await db.lesson.findFirst({
          where: {
            unit: {
              chapter: {
                course: { organizationId: req.account.organizationId },
              },
            },
            OR: [
              { contentUrl: { in: references } },
              { attachedPdfUrl: { in: references } },
              { homeworkPdfUrl: { in: references } },
            ],
          },
          select: { unitId: true },
        });
        if (!lesson) {
          throw new ForbiddenException('You do not have access to this file');
        }
        const access = await this.catalogService.getUnitAccess(
          req.account.id,
          lesson.unitId,
        );
        if (!access.hasAccess) {
          throw new ForbiddenException('You do not have access to this file');
        }
      }
    }

    const filePath = path.join(
      process.cwd(),
      '.uploads',
      'storage',
      obj.objectKey,
    );
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File not found on disk');
    }

    res.setHeader('Content-Type', obj.mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${obj.originalName}"`,
    );
    fs.createReadStream(filePath).pipe(res);
  }

  @Get('receipts/:id')
  @UseGuards(SessionAuthGuard)
  async getReceipt(
    @Req() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    try {
      // In a real env, we'd only serve APPROVED objects, but since this is local testing
      // we'll bypass the strict Approved check and just fetch it from DB directly if needed.
      // We'll just fetch it using getApprovedObject and ensure we mark it APPROVED upon upload.
      const obj = await this.storageService.getApprovedObject(id);
      if (
        obj.organizationId !== req.account.organizationId ||
        (req.account.kind !== 'STAFF' && obj.uploadedBy !== req.account.id)
      ) {
        throw new ForbiddenException('You do not have access to this receipt');
      }

      const filePath = path.join(
        process.cwd(),
        '.uploads',
        'receipts',
        obj.objectKey,
      );

      if (!fs.existsSync(filePath)) {
        throw new NotFoundException('File not found on disk');
      }

      res.setHeader('Content-Type', obj.mimeType);
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch {
      throw new NotFoundException('Receipt not found');
    }
  }
}
