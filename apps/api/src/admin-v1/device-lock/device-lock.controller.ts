import {
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
import { AdminV1DeviceLockService } from './device-lock.service';
import { DeviceLockListQueryDto } from './device-lock.dto';

type AdminRequest = Request & {
  account: { id: string; organizationId: string; kind: string };
};

@Controller('admin/v1/device-locks')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.STUDENT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1DeviceLockController {
  constructor(private readonly deviceLock: AdminV1DeviceLockService) {}

  @Get()
  list(@Req() request: AdminRequest, @Query() query: DeviceLockListQueryDto) {
    return this.deviceLock.list(request.account.organizationId, {
      search: query.search,
      gradeId: query.gradeId,
      reason: query.reason,
      status: query.status,
      blockedFrom: query.blockedFrom,
      blockedTo: query.blockedTo,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
    });
  }

  @Post(':accountId/unlock')
  unlock(@Req() request: AdminRequest, @Param('accountId') accountId: string) {
    return this.deviceLock.unlock(request.account, accountId);
  }

  @Post(':accountId/allow-device')
  allowDevice(
    @Req() request: AdminRequest,
    @Param('accountId') accountId: string,
  ) {
    return this.deviceLock.allowDevice(request.account, accountId);
  }

  @Post(':accountId/reset-primary')
  resetPrimary(
    @Req() request: AdminRequest,
    @Param('accountId') accountId: string,
  ) {
    return this.deviceLock.resetPrimary(request.account, accountId);
  }
}
