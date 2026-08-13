import { Module } from '@nestjs/common';
import { AdminV1OfflineCodesController } from './offline-codes.controller';
import { OfflineCodesModule } from '../../offline-codes/offline-codes.module';

@Module({
  imports: [OfflineCodesModule],
  controllers: [AdminV1OfflineCodesController],
})
export class AdminV1OfflineCodesModule {}
