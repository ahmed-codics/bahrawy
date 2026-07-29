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
import {
  CreateStaffDto,
  UpdateOrganizationDto,
  UpdateStaffDto,
} from './management.dto';
import { AdminV1ManagementService } from './management.service';
import { LifecycleMutationDto } from '../common/dto/lifecycle.dto';

type AdminRequest = Request & {
  account: { id: string; organizationId: string };
};

@Controller('admin/v1/management')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.STAFF_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1ManagementController {
  constructor(private readonly management: AdminV1ManagementService) {}

  @Get('staff')
  staff(
    @Req() request: AdminRequest,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.management.staff(
      request.account.organizationId,
      search,
      status,
      Number(page) || 1,
      Number(pageSize) || 25,
    );
  }

  @Get('roles')
  roles() {
    return this.management.roles();
  }

  @Post('staff')
  createStaff(@Req() request: AdminRequest, @Body() input: CreateStaffDto) {
    return this.management.createStaff(request.account, input);
  }

  @Patch('staff/:id')
  updateStaff(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: UpdateStaffDto,
  ) {
    return this.management.updateStaff(request.account, id, input);
  }

  @Get('staff/:id/deletion-impact')
  staffDeletionImpact(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.management.staffDeletionImpact(
      request.account.organizationId,
      id,
    );
  }

  @Post('staff/:id/archive')
  archiveStaff(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: LifecycleMutationDto,
  ) {
    return this.management.setStaffArchived(request.account, id, true, input);
  }

  @Post('staff/:id/restore')
  restoreStaff(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: LifecycleMutationDto,
  ) {
    return this.management.setStaffArchived(request.account, id, false, input);
  }

  @Get('audit')
  audit(
    @Req() request: AdminRequest,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.management.auditEvents(
      request.account.organizationId,
      action,
      actorId,
      targetType,
      Number(page) || 1,
      Number(pageSize) || 50,
    );
  }

  @Get('organization')
  organization(@Req() request: AdminRequest) {
    return this.management.organization(request.account.organizationId);
  }

  @Patch('organization')
  updateOrganization(
    @Req() request: AdminRequest,
    @Body() input: UpdateOrganizationDto,
  ) {
    return this.management.updateOrganization(request.account, input);
  }
}
