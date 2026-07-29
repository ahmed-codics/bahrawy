import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { ReviewPaymentDto } from './payments.dto';
import { AdminV1PaymentsService } from './payments.service';

type AdminRequest = Request & {
  account: { id: string; organizationId: string };
};

@Controller('admin/v1/payments')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.PAYMENT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1PaymentsController {
  constructor(private readonly payments: AdminV1PaymentsService) {}

  @Get()
  list(
    @Req() request: AdminRequest,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.payments.list(
      request.account.organizationId,
      status,
      search,
      Number(page) || 1,
      Number(pageSize) || 25,
    );
  }

  @Patch(':id/review')
  review(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: ReviewPaymentDto,
  ) {
    return this.payments.review(request.account, id, input);
  }
}
