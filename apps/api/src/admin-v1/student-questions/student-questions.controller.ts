import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { Request } from 'express';
import { StaffPermission } from '@bahrawy/types';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequireAdminPermission } from '../common/decorators/require-permission.decorator';
import { AdminApiErrorFilter } from '../common/filters/admin-error.filter';
import { AdminApiResponseInterceptor } from '../common/interceptors/admin-response.interceptor';
import {
  AdminStudentQuestionReplyDto,
  ListStudentQuestionsQueryDto,
  UpdateStudentQuestionStatusDto,
} from './student-questions.dto';
import { AdminV1StudentQuestionsService } from './student-questions.service';
import { MulterSizeErrorFilter } from '../../student-questions/multer-size.filter';
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VOICE_SIZE_BYTES,
  StudentQuestionAttachmentsService,
} from '../../student-questions/student-questions-attachments.service';

type AdminRequest = Request & {
  account: { id: string; organizationId: string };
};

@Controller('admin/v1/student-questions')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.STUDENT_QUESTION_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1StudentQuestionsController {
  constructor(
    private readonly service: AdminV1StudentQuestionsService,
    private readonly attachments: StudentQuestionAttachmentsService,
  ) {}

  @Post('uploads')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: path.join(process.cwd(), '.uploads', 'tmp'),
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_IMAGE_SIZE_BYTES },
    }),
  )
  @UseFilters(new MulterSizeErrorFilter())
  async upload(
    @Req() request: AdminRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.attachments.upload(request.account, file);
    return data;
  }

  @Post('uploads/voice')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: path.join(process.cwd(), '.uploads', 'tmp'),
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${path.extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_VOICE_SIZE_BYTES },
    }),
  )
  @UseFilters(new MulterSizeErrorFilter('voice'))
  async uploadVoice(
    @Req() request: AdminRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.attachments.uploadVoice(request.account, file);
    return data;
  }

  @Get()
  list(
    @Req() request: AdminRequest,
    @Query() query: ListStudentQuestionsQueryDto,
  ) {
    return this.service.list(
      request.account,
      query.status,
      query.search,
      query.gradeId,
      query.page ?? 1,
      query.pageSize ?? 25,
    );
  }

  @Get('policy')
  policy() {
    return this.attachments.getPolicy();
  }

  @Get(':id')
  detail(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.service.detail(request.account, id);
  }

  @Post(':id/replies')
  reply(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: AdminStudentQuestionReplyDto,
  ) {
    return this.service.reply(request.account, id, input);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: UpdateStudentQuestionStatusDto,
  ) {
    return this.service.updateStatus(request.account, id, input);
  }
}
