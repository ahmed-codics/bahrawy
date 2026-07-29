import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Query,
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
  ProductInputDto,
  UpdateProductDto,
  UpsertCommerceDto,
} from './products.dto';
import { AdminV1ProductsService } from './products.service';
import {
  LifecycleMutationDto,
  PermanentDeleteDto,
} from '../common/dto/lifecycle.dto';

type AdminRequest = Request & {
  account: { id: string; organizationId: string };
};

@Controller('admin/v1/products')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.PRODUCT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1ProductsController {
  constructor(private readonly productsService: AdminV1ProductsService) {}

  @Get()
  list(
    @Req() request: AdminRequest,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('gradeId') gradeId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.productsService.list(
      request.account.organizationId,
      search,
      status,
      gradeId,
      Number(page) || 1,
      Number(pageSize) || 24,
    );
  }

  @Post()
  create(@Req() request: AdminRequest, @Body() input: ProductInputDto) {
    return this.productsService.create(request.account, input);
  }

  @Get(':id')
  detail(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.productsService.detail(request.account.organizationId, id);
  }

  @Patch(':id')
  update(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.productsService.update(request.account, id, input);
  }

  @Get(':id/deletion-impact')
  deletionImpact(@Req() request: AdminRequest, @Param('id') id: string) {
    return this.productsService.deletionImpact(
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
    return this.productsService.setArchived(request.account, id, true, input);
  }

  @Post(':id/restore')
  restore(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: LifecycleMutationDto,
  ) {
    return this.productsService.setArchived(request.account, id, false, input);
  }

  @Delete(':id')
  permanentlyDelete(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: PermanentDeleteDto,
  ) {
    return this.productsService.permanentlyDelete(request.account, id, input);
  }

  @Post('course/:courseId/commerce')
  upsertCourseCommerce(
    @Req() request: AdminRequest,
    @Param('courseId') courseId: string,
    @Body() input: UpsertCommerceDto,
  ) {
    return this.productsService.upsertCourseCommerce(
      request.account,
      courseId,
      input,
    );
  }

  @Post('unit/:unitId/commerce')
  upsertUnitCommerce(
    @Req() request: AdminRequest,
    @Param('unitId') unitId: string,
    @Body() input: UpsertCommerceDto,
  ) {
    return this.productsService.upsertUnitCommerce(
      request.account,
      unitId,
      input,
    );
  }
}
