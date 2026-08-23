import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { StaffPermission } from '@bahrawy/types';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { RequireAdminPermission } from '../common/decorators/require-permission.decorator';
import { AdminApiErrorFilter } from '../common/filters/admin-error.filter';
import { AdminApiResponseInterceptor } from '../common/interceptors/admin-response.interceptor';
import { AdminV1VideoAccessService } from './video-access.service';
import {
  ApproveVideoAccessRequestDto,
  RejectVideoAccessRequestDto,
  RevokeVideoAccessGrantDto,
  VideoAccessRequestListQueryDto,
} from './video-access.dto';

type AdminRequest = Request & {
  account: { id: string; organizationId: string; kind: string };
};

@Controller('admin/v1/video-access')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.VIDEO_ACCESS_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1VideoAccessController {
  constructor(private readonly service: AdminV1VideoAccessService) {}

  @Get('requests')
  list(
    @Req() request: AdminRequest,
    @Query() query: VideoAccessRequestListQueryDto,
  ) {
    return this.service.list(request.account.organizationId, query);
  }

  @Get('stats')
  stats(@Req() request: AdminRequest) {
    return this.service.stats(request.account.organizationId);
  }

  @Post('requests/:id/approve')
  approve(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() dto: ApproveVideoAccessRequestDto,
  ) {
    return this.service.approve(request.account, id, dto);
  }

  @Post('requests/:id/reject')
  reject(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() dto: RejectVideoAccessRequestDto,
  ) {
    return this.service.reject(request.account, id, dto);
  }

  @Post('grants/:id/revoke')
  revoke(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() dto: RevokeVideoAccessGrantDto,
  ) {
    return this.service.revoke(request.account, id, dto?.reason ?? null);
  }
}
