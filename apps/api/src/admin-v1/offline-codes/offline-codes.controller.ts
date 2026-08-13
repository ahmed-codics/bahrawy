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
import { OfflineCodesService } from '../../offline-codes/offline-codes.service';
import {
  BatchListQueryDto,
  BulkOfflineCodeDeleteDto,
  BulkOfflineCodeStatusDto,
  GenerateOfflineCodesDto,
  OfflineCodeListQueryDto,
  UpdateOfflineCodeStatusDto,
} from './offline-codes.dto';

type AdminRequest = Request & {
  account: { id: string; organizationId: string; kind: string };
};

@Controller('admin/v1/offline-codes')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.STUDENT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1OfflineCodesController {
  constructor(private readonly offlineCodes: OfflineCodesService) {}

  @Post('generate')
  generate(
    @Req() request: AdminRequest,
    @Body() body: GenerateOfflineCodesDto,
  ) {
    return this.offlineCodes.generateCodes(request.account, {
      quantity: body.quantity,
      courseId: body.courseId,
      gradeId: body.gradeId,
      expiresAt: body.expiresAt,
      maxUses: body.maxUses,
      reason: body.reason,
    });
  }

  @Get()
  list(@Req() request: AdminRequest, @Query() query: OfflineCodeListQueryDto) {
    return this.offlineCodes.listCodes(request.account.organizationId, {
      search: query.search,
      gradeId: query.gradeId,
      courseId: query.courseId,
      status: query.status,
      used: query.used,
      expired: query.expired,
      batchId: query.batchId,
      createdFrom: query.createdFrom,
      createdTo: query.createdTo,
      activatedFrom: query.activatedFrom,
      activatedTo: query.activatedTo,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
    });
  }

  @Get(':id')
  get(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.offlineCodes.getCode(request.account.organizationId, id);
  }

  @Patch(':id/status')
  updateStatus(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() body: UpdateOfflineCodeStatusDto,
  ) {
    return this.offlineCodes.setCodeStatus(
      request.account,
      id,
      body.status as 'ACTIVE' | 'DISABLED',
      body.reason,
    );
  }

  @Post('bulk/status')
  bulkStatus(
    @Req() request: AdminRequest,
    @Body() body: BulkOfflineCodeStatusDto,
  ) {
    return this.offlineCodes.bulkSetCodeStatus(
      request.account,
      body.ids,
      body.status as 'ACTIVE' | 'DISABLED',
      body.reason,
    );
  }

  @Post('bulk/delete')
  bulkDelete(
    @Req() request: AdminRequest,
    @Body() body: BulkOfflineCodeDeleteDto,
  ) {
    return this.offlineCodes.bulkDeleteCodes(
      request.account,
      body.ids,
      body.reason,
    );
  }

  @Get('batches/list')
  listBatches(@Req() request: AdminRequest, @Query() query: BatchListQueryDto) {
    return this.offlineCodes.listBatches(request.account.organizationId, {
      courseId: query.courseId,
      gradeId: query.gradeId,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 25,
    });
  }

  @Get('batches/:id')
  getBatch(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.offlineCodes.getBatch(request.account.organizationId, id);
  }

  @Get('batches/:id/export')
  exportBatch(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.offlineCodes.exportBatch(request.account.organizationId, id);
  }
}
