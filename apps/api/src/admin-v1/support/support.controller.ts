import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { ReplyTicketDto, UpdateTicketDto } from './support.dto';
import { AdminV1SupportService } from './support.service';

type AdminRequest = Request & {
  account: { id: string; organizationId: string };
};

@Controller('admin/v1/support')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.SUPPORT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1SupportController {
  constructor(private readonly support: AdminV1SupportService) {}

  @Get()
  list(
    @Req() request: AdminRequest,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.support.list(
      request.account.organizationId,
      status,
      priority,
      search,
      Number(page) || 1,
      Number(pageSize) || 25,
    );
  }

  @Get('staff')
  staff(@Req() request: AdminRequest) {
    return this.support.staff(request.account.organizationId);
  }

  @Get(':id')
  detail(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.support.detail(request.account.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: UpdateTicketDto,
  ) {
    return this.support.update(request.account, id, input);
  }

  @Post(':id/messages')
  reply(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: ReplyTicketDto,
  ) {
    return this.support.reply(request.account, id, input);
  }
}
