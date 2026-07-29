import { Module } from '@nestjs/common';
import { AdminV1ProductsController } from './products.controller';
import { AdminV1ProductsService } from './products.service';
import { AdminAuditService } from '../common/services/audit.service';

@Module({
  controllers: [AdminV1ProductsController],
  providers: [AdminV1ProductsService, AdminAuditService],
})
export class AdminV1ProductsModule {}
