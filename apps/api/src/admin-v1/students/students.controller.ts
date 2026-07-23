import {
  Body,
  Controller,
  Delete,
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
  CreateStudentDto,
  GrantEntitlementDto,
  ReasonDto,
  StudentStatusDto,
  UpdateEntitlementDto,
} from './students.dto';
import { AdminV1StudentsService } from './students.service';

type AdminRequest = Request & {
  account: { id: string; organizationId: string };
};

@Controller('admin/v1/students')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.STUDENT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1StudentsController {
  constructor(private readonly students: AdminV1StudentsService) {}

  @Get()
  list(
    @Req() request: AdminRequest,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('gradeId') gradeId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.students.list(
      request.account.organizationId,
      search,
      status,
      gradeId,
      Number(page) || 1,
      Number(pageSize) || 25,
    );
  }

  @Get(':id')
  detail(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.students.detail(request.account.organizationId, id);
  }

  @Post()
  create(@Req() request: AdminRequest, @Body() input: CreateStudentDto) {
    return this.students.create(request.account, input);
  }

  @Patch(':id/status')
  setStatus(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: StudentStatusDto,
  ) {
    return this.students.setStatus(request.account, id, input);
  }

  @Delete(':id/devices/:deviceId')
  revokeDevice(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Param('deviceId') deviceId: string,
    @Body() input: ReasonDto,
  ) {
    return this.students.revokeDevice(
      request.account,
      id,
      deviceId,
      input.reason,
    );
  }

  @Post(':id/sessions/revoke')
  revokeSessions(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: ReasonDto,
  ) {
    return this.students.revokeSessions(request.account, id, input.reason);
  }

  @Post(':id/entitlements')
  grantEntitlement(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: GrantEntitlementDto,
  ) {
    return this.students.grantEntitlement(request.account, id, input);
  }

  @Patch('entitlements/:id')
  updateEntitlement(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: UpdateEntitlementDto,
  ) {
    return this.students.updateEntitlement(request.account, id, input);
  }
}
