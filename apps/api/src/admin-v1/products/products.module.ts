import { Module } from '@nestjs/common';
import { AdminV1ProductsController } from './products.controller';
import { AdminV1ProductsService } from './products.service';

@Module({
  controllers: [AdminV1ProductsController],
  providers: [AdminV1ProductsService],
})
export class AdminV1ProductsModule {}
