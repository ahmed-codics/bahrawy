import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Response } from 'express';
import * as fs from 'fs';
import { StudentQuestionAttachmentsService } from './student-questions-attachments.service';

/**
 * Serves attached question images through short-lived HMAC-signed URLs. No
 * SessionAuthGuard here (an `<img>` tag cannot send the device-fingerprint
 * header); the signed URL is only issued after ownership/RBAC checks on the
 * detail/list endpoints, and a tampered URL fails verification.
 */
@Controller('student/questions/:questionId/attachments')
export class StudentQuestionAttachmentsController {
  constructor(
    private readonly attachments: StudentQuestionAttachmentsService,
  ) {}

  @Get(':attachmentId')
  async image(
    @Param('questionId') questionId: string,
    @Param('attachmentId') attachmentId: string,
    @Query('expires') expires: string,
    @Query('token') token: string,
    @Query('account') account: string,
    @Res() res: Response,
  ) {
    const accountId = typeof account === 'string' ? account : '';
    if (
      !this.attachments.verifyImageToken(
        accountId,
        questionId,
        attachmentId,
        expires,
        token,
      )
    ) {
      throw new UnauthorizedException('Invalid or expired image link');
    }
    const { mimeType, filePath } = await this.attachments.resolveFile(
      questionId,
      attachmentId,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, max-age=600');
    fs.createReadStream(filePath).pipe(res);
  }
}
