import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { DeviceLeaseService } from './device-lease.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';

@Controller('devices')
@UseGuards(SessionAuthGuard)
export class DeviceLeaseController {
  constructor(private readonly deviceLeaseService: DeviceLeaseService) {}

  @Get()
  async getDevices(@Req() req: any) {
    const data = await this.deviceLeaseService.getDevices(req.account.id);
    return { status: 'SUCCESS', data };
  }

  @Post('reset')
  async resetDevices(@Req() req: any) {
    await this.deviceLeaseService.resetStudentDevices(req.account.id);
    return { status: 'SUCCESS', message: 'Devices reset successfully' };
  }
}
