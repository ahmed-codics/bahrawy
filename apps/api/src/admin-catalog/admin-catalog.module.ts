import { Module } from '@nestjs/common';
import { AdminCatalogController, StaffCatalogController } from './admin-catalog.controller';
import { AdminCatalogService } from './admin-catalog.service';

@Module({
  controllers: [AdminCatalogController, StaffCatalogController],
  providers: [AdminCatalogService],
  exports: [AdminCatalogService],
})
export class AdminCatalogModule {}
