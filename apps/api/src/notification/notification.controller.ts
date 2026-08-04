import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';

@Controller('notifications')
@UseGuards(SessionAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(@Req() req: any) {
    const data = await this.notificationService.getNotifications(
      req.account.id,
    );
    return { status: 'SUCCESS', data };
  }

  @Post(':id/read')
  async markAsRead(@Req() req: any, @Param('id') id: string) {
    await this.notificationService.markAsRead(req.account.id, id);
    return { status: 'SUCCESS' };
  }
}
