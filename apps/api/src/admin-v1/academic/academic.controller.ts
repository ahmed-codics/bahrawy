import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
  CreateAcademicEntityDto,
  CreateAcademicYearDto,
  CreateCohortDto,
  CreateTermDto,
  ReorderDto,
  UpdateAcademicEntityDto,
} from './academic.dto';
import { AdminV1AcademicService } from './academic.service';

type AdminRequest = Request & {
  account: { id: string; organizationId: string; kind: string };
};

@Controller('admin/v1/academic')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.CATALOG_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1AcademicController {
  constructor(private readonly academicService: AdminV1AcademicService) {}

  @Get()
  overview(@Req() request: AdminRequest) {
    return this.academicService.overview(request.account.organizationId);
  }

  @Post(':entity')
  createEntity(
    @Req() request: AdminRequest,
    @Param('entity') entity: 'grades' | 'subjects',
    @Body() input: CreateAcademicEntityDto,
  ) {
    return this.academicService.createEntity(
      request.account.organizationId,
      entity,
      input,
    );
  }

  @Patch(':entity/:id')
  updateEntity(
    @Req() request: AdminRequest,
    @Param('entity') entity: 'grades' | 'subjects',
    @Param('id') id: string,
    @Body() input: UpdateAcademicEntityDto,
  ) {
    return this.academicService.updateEntity(
      request.account.organizationId,
      entity,
      id,
      input,
    );
  }

  @Post('academic-years/create')
  createAcademicYear(
    @Req() request: AdminRequest,
    @Body() input: CreateAcademicYearDto,
  ) {
    return this.academicService.createAcademicYear(
      request.account.organizationId,
      input,
    );
  }

  @Post('cohorts/create')
  createCohort(@Req() request: AdminRequest, @Body() input: CreateCohortDto) {
    return this.academicService.createCohort(
      request.account.organizationId,
      input,
    );
  }

  @Post('terms/create')
  createTerm(@Req() request: AdminRequest, @Body() input: CreateTermDto) {
    return this.academicService.createTerm(
      request.account.organizationId,
      input,
    );
  }

  @Patch('grades/reorder')
  reorderGrades(@Req() request: AdminRequest, @Body() input: ReorderDto) {
    return this.academicService.reorderGrades(
      request.account.organizationId,
      input.ids,
    );
  }
}
