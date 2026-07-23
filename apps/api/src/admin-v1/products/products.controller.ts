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
import { ProductInputDto, UpdateProductDto } from './products.dto';
import { AdminV1ProductsService } from './products.service';

type AdminRequest = Request & { account: { organizationId: string } };

@Controller('admin/v1/products')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequireAdminPermission(StaffPermission.PRODUCT_MANAGE)
@UseInterceptors(AdminApiResponseInterceptor)
@UseFilters(AdminApiErrorFilter)
export class AdminV1ProductsController {
  constructor(private readonly productsService: AdminV1ProductsService) {}

  @Get()
  list(@Req() request: AdminRequest) {
    return this.productsService.list(request.account.organizationId);
  }

  @Post()
  create(@Req() request: AdminRequest, @Body() input: ProductInputDto) {
    return this.productsService.create(request.account.organizationId, input);
  }

  @Patch(':id')
  update(
    @Req() request: AdminRequest,
    @Param('id') id: string,
    @Body() input: UpdateProductDto,
  ) {
    return this.productsService.update(
      request.account.organizationId,
      id,
      input,
    );
  }
}
