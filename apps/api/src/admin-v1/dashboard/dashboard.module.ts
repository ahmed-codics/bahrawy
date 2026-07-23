import { Module } from '@nestjs/common';
import { AdminV1DashboardController } from './dashboard.controller';
import { AdminV1DashboardService } from './dashboard.service';

@Module({
  controllers: [AdminV1DashboardController],
  providers: [AdminV1DashboardService],
})
export class AdminV1DashboardModule {}
