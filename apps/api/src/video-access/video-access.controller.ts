import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { DeviceGuard } from '../device-lease/device.guard';
import { Throttle } from '../throttle/throttle.decorator';
import { StudentVideoAccessRequestService } from './video-access.service';
import { CreateVideoAccessRequestDto } from './video-access.dto';

type AuthedRequest = Request & {
  account: { id: string; organizationId: string; kind: string };
  session?: { id?: string };
};

const REQUEST_CREATE_LIMIT = 5;
const REQUEST_CREATE_WINDOW_MS = 60_000;

@Controller('video-access-requests')
@UseGuards(SessionAuthGuard)
export class StudentVideoAccessRequestController {
  constructor(private readonly service: StudentVideoAccessRequestService) {}

  @Post()
  @Throttle(REQUEST_CREATE_LIMIT, REQUEST_CREATE_WINDOW_MS)
  @UseGuards(DeviceGuard)
  async create(
    @Req() req: AuthedRequest,
    @Body() dto: CreateVideoAccessRequestDto,
  ) {
    const data = await this.service.create(req.account, req.session?.id, dto);
    return { status: 'SUCCESS', data };
  }

  @Get('mine')
  async myRequests(@Req() req: AuthedRequest) {
    const data = await this.service.myRequests(req.account.id);
    return { status: 'SUCCESS', data };
  }

  @Get(':lessonId/status')
  @UseGuards(DeviceGuard)
  async status(@Req() req: AuthedRequest, @Param('lessonId') lessonId: string) {
    const data = await this.service.statusForLesson(req.account, lessonId);
    return { status: 'SUCCESS', data };
  }
}
