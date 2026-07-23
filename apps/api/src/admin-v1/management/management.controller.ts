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
  staff(@Req() request: AdminRequest) {
    return this.management.staff(request.account.organizationId);
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

  @Get('audit')
  audit(
    @Req() request: AdminRequest,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('targetType') targetType?: string,
  ) {
    return this.management.auditEvents(
      request.account.organizationId,
      action,
      actorId,
      targetType,
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
