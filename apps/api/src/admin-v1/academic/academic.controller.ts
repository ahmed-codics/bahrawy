import {
  Body,
  Controller,
  Delete,
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
import {
  LifecycleMutationDto,
  PermanentDeleteDto,
} from '../common/dto/lifecycle.dto';

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
    return this.academicService.createEntity(request.account, entity, input);
  }

  @Patch(':entity/:id')
  updateEntity(
    @Req() request: AdminRequest,
    @Param('entity') entity: 'grades' | 'subjects',
    @Param('id') id: string,
    @Body() input: UpdateAcademicEntityDto,
  ) {
    return this.academicService.updateEntity(
      request.account,
      entity,
      id,
      input,
    );
  }

  @Get(':entity/:id/deletion-impact')
  deletionImpact(
    @Req() request: AdminRequest,
    @Param('entity') entity: 'grades' | 'subjects',
    @Param('id') id: string,
  ) {
    return this.academicService.deletionImpact(
      request.account.organizationId,
      entity,
      id,
    );
  }

  @Post(':entity/:id/archive')
  archive(
    @Req() request: AdminRequest,
    @Param('entity') entity: 'grades' | 'subjects',
    @Param('id') id: string,
    @Body() input: LifecycleMutationDto,
  ) {
    return this.academicService.setArchived(
      request.account,
      entity,
      id,
      true,
      input,
    );
  }

  @Post(':entity/:id/restore')
  restore(
    @Req() request: AdminRequest,
    @Param('entity') entity: 'grades' | 'subjects',
    @Param('id') id: string,
    @Body() input: LifecycleMutationDto,
  ) {
    return this.academicService.setArchived(
      request.account,
      entity,
      id,
      false,
      input,
    );
  }

  @Delete(':entity/:id')
  permanentlyDelete(
    @Req() request: AdminRequest,
    @Param('entity') entity: 'grades' | 'subjects',
    @Param('id') id: string,
    @Body() input: PermanentDeleteDto,
  ) {
    return this.academicService.permanentlyDelete(
      request.account,
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
    return this.academicService.createAcademicYear(request.account, input);
  }

  @Post('cohorts/create')
  createCohort(@Req() request: AdminRequest, @Body() input: CreateCohortDto) {
    return this.academicService.createCohort(request.account, input);
  }

  @Post('terms/create')
  createTerm(@Req() request: AdminRequest, @Body() input: CreateTermDto) {
    return this.academicService.createTerm(request.account, input);
  }

  @Patch('grades/reorder')
  reorderGrades(@Req() request: AdminRequest, @Body() input: ReorderDto) {
    return this.academicService.reorderGrades(request.account, input.ids);
  }
}
