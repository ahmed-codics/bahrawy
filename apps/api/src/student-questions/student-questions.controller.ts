import {
  Body,
  Controller,
  Get,
  Param,
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
import { SessionAuthGuard } from '../auth/session-auth.guard';
import {
  CreateStudentQuestionDto,
  ListStudentQuestionsQueryDto,
  StudentQuestionReplyDto,
} from './student-questions.dto';
import { StudentQuestionsService } from './student-questions.service';
import {
  MAX_IMAGE_SIZE_BYTES,
  MAX_VOICE_SIZE_BYTES,
  StudentQuestionAttachmentsService,
} from './student-questions-attachments.service';
import { MulterSizeErrorFilter } from './multer-size.filter';

@Controller('student/questions')
@UseGuards(SessionAuthGuard)
export class StudentQuestionsController {
  constructor(
    private readonly service: StudentQuestionsService,
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
  async upload(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    const data = await this.attachments.upload(req.account, file);
    return { status: 'SUCCESS' as const, data };
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
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const data = await this.attachments.uploadVoice(req.account, file);
    return { status: 'SUCCESS' as const, data };
  }

  @Get('policy')
  policy() {
    return { status: 'SUCCESS' as const, data: this.attachments.getPolicy() };
  }

  @Get()
  list(@Req() req: any, @Query() query: ListStudentQuestionsQueryDto) {
    return this.service
      .list(req.account, query.status, query.page ?? 1, query.pageSize ?? 50)
      .then((data) => ({
        status: 'SUCCESS' as const,
        data,
      }));
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateStudentQuestionDto) {
    return this.service.create(req.account, body).then((data) => ({
      status: 'SUCCESS' as const,
      data,
    }));
  }

  @Get(':id')
  detail(@Req() req: any, @Param('id') id: string) {
    return this.service.detail(req.account, id).then((data) => ({
      status: 'SUCCESS' as const,
      data,
    }));
  }

  @Post(':id/messages')
  reply(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: StudentQuestionReplyDto,
  ) {
    return this.service.reply(req.account, id, body).then((data) => ({
      status: 'SUCCESS' as const,
      data,
    }));
  }
}
