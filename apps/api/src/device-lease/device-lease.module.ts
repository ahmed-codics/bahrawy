import { Module, Global } from '@nestjs/common';
import { DeviceLeaseService } from './device-lease.service';
import { DeviceGuard } from './device.guard';
import { DeviceLeaseController } from './device-lease.controller';

@Global()
@Module({
  controllers: [DeviceLeaseController],
  providers: [DeviceLeaseService, DeviceGuard],
  exports: [DeviceLeaseService, DeviceGuard],
})
export class DeviceLeaseModule {}
