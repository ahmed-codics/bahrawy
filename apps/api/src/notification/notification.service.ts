import { Injectable } from '@nestjs/common';
import { db } from '@bahrawy/db';

@Injectable()
export class NotificationService {
  async getNotifications(accountId: string): Promise<any[]> {
    return db.inAppNotification.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(accountId: string, notificationId: string): Promise<any> {
    return db.inAppNotification.updateMany({
      where: { id: notificationId, accountId },
      data: { readAt: new Date() },
    });
  }
}
