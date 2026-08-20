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
import { StudentQuestionAttachmentsService } from '../../student-questions/student-questions-attachments.service';

/**
 * Serves attached question images for the admin panel through short-lived
 * HMAC-signed URLs. The signed URL is only issued by the admin detail/list
 * endpoints after RBAC + organization checks, so streaming here only needs to
 * verify the token (no session cookie is available from an `<img>` tag).
 */
@Controller('admin/v1/student-questions/:questionId/attachments')
export class AdminV1StudentQuestionAttachmentsController {
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
