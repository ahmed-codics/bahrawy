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
  CreateContentNodeDto,
  CreateCourseDto,
  ReorderContentDto,
  UpdateContentNodeDto,
  UpdateCourseDto,
} from './courses.dto';
import { AdminV1CoursesService } from './courses.service';

type AdminRequest = Request & {
  account: { id: string; organizationId: string };
};

@Controller('admin/v1/courses')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.CATALOG_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1CoursesController {
  constructor(private readonly coursesService: AdminV1CoursesService) {}

  @Get()
  list(
    @Req() request: AdminRequest,
    @Query('gradeId') gradeId?: string,
    @Query('status') status?: string,
  ) {
    return this.coursesService.list(
      request.account.organizationId,
      gradeId,
      status,
    );
  }

  @Post()
  create(@Req() request: AdminRequest, @Body() input: CreateCourseDto) {
    return this.coursesService.create(request.account.organizationId, input);
  }

  @Get(':id')
  detail(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.coursesService.detail(request.account.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: UpdateCourseDto,
  ) {
    return this.coursesService.update(
      request.account.organizationId,
      id,
      input,
    );
  }

  @Post(':courseId/chapters')
  createChapter(
    @Req() request: AdminRequest,
    @Param('courseId') courseId: string,
    @Body() input: CreateContentNodeDto,
  ) {
    return this.coursesService.createNode(
      request.account.organizationId,
      'course',
      courseId,
      input,
    );
  }

  @Post('chapters/:chapterId/units')
  createUnit(
    @Req() request: AdminRequest,
    @Param('chapterId') chapterId: string,
    @Body() input: CreateContentNodeDto,
  ) {
    return this.coursesService.createNode(
      request.account.organizationId,
      'chapter',
      chapterId,
      input,
    );
  }

  @Post('units/:unitId/lessons')
  createLesson(
    @Req() request: AdminRequest,
    @Param('unitId') unitId: string,
    @Body() input: CreateContentNodeDto,
  ) {
    return this.coursesService.createNode(
      request.account.organizationId,
      'unit',
      unitId,
      input,
    );
  }

  @Patch(':nodeType/:id/content')
  updateNode(
    @Req() request: AdminRequest,
    @Param('nodeType') nodeType: 'chapter' | 'unit' | 'lesson',
    @Param('id') id: string,
    @Body() input: UpdateContentNodeDto,
  ) {
    return this.coursesService.updateNode(
      request.account.organizationId,
      nodeType,
      id,
      input,
    );
  }

  @Patch(':nodeType/:parentId/reorder')
  reorder(
    @Req() request: AdminRequest,
    @Param('nodeType') nodeType: 'chapter' | 'unit' | 'lesson',
    @Param('parentId') parentId: string,
    @Body() input: ReorderContentDto,
  ) {
    return this.coursesService.reorder(
      request.account.organizationId,
      nodeType,
      parentId,
      input.ids,
    );
  }
}
