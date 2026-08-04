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
  CreateContentNodeDto,
  CreateCourseDto,
  ReorderContentDto,
  UpdateContentNodeDto,
  UpdateCourseDto,
  UpdateLessonLifecycleDto,
} from './courses.dto';
import { AdminV1CoursesService } from './courses.service';
import {
  LifecycleMutationDto,
  PermanentDeleteDto,
} from '../common/dto/lifecycle.dto';

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
    @Query('search') search?: string,
    @Query('subjectId') subjectId?: string,
    @Query('termId') termId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.coursesService.list(
      request.account.organizationId,
      gradeId,
      status,
      search,
      subjectId,
      termId,
      Number(page) || 1,
      Number(pageSize) || 24,
    );
  }

  @Post()
  create(@Req() request: AdminRequest, @Body() input: CreateCourseDto) {
    return this.coursesService.create(request.account, input);
  }

  @Get(':id')
  detail(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.coursesService.detail(request.account.organizationId, id);
  }

  @Get('units/:unitId')
  unitDetail(@Req() request: AdminRequest, @Param('unitId') unitId: string) {
    return this.coursesService.unitDetail(
      request.account.organizationId,
      unitId,
    );
  }

  @Get('lessons/:lessonId')
  lessonDetail(
    @Req() request: AdminRequest,
    @Param('lessonId') lessonId: string,
  ) {
    return this.coursesService.lessonDetail(
      request.account.organizationId,
      lessonId,
    );
  }

  @Patch(':id')
  update(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: UpdateCourseDto,
  ) {
    return this.coursesService.update(request.account, id, input);
  }

  @Get(':id/deletion-impact')
  deletionImpact(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.coursesService.deletionImpact(
      request.account.organizationId,
      id,
    );
  }

  @Post(':id/archive')
  archive(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: LifecycleMutationDto,
  ) {
    return this.coursesService.setArchived(request.account, id, true, input);
  }

  @Post(':id/restore')
  restore(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: LifecycleMutationDto,
  ) {
    return this.coursesService.setArchived(request.account, id, false, input);
  }

  @Delete(':id')
  permanentlyDelete(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: PermanentDeleteDto,
  ) {
    return this.coursesService.permanentlyDelete(request.account, id, input);
  }

  @Post(':courseId/chapters')
  createChapter(
    @Req() request: AdminRequest,
    @Param('courseId') courseId: string,
    @Body() input: CreateContentNodeDto,
  ) {
    return this.coursesService.createNode(
      request.account,
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
      request.account,
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
      request.account,
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
    return this.coursesService.updateNode(request.account, nodeType, id, input);
  }

  @Patch(':nodeType/:parentId/reorder')
  reorder(
    @Req() request: AdminRequest,
    @Param('nodeType') nodeType: 'chapter' | 'unit' | 'lesson',
    @Param('parentId') parentId: string,
    @Body() input: ReorderContentDto,
  ) {
    return this.coursesService.reorder(
      request.account,
      nodeType,
      parentId,
      input.ids,
    );
  }

  @Patch('units/:unitId/lifecycle')
  updateLessonLifecycle(
    @Req() request: AdminRequest,
    @Param('unitId') unitId: string,
    @Body() input: UpdateLessonLifecycleDto,
  ) {
    return this.coursesService.updateLessonLifecycle(
      request.account,
      unitId,
      input.status,
      input.version,
    );
  }
}
