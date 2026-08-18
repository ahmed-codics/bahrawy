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

  async create(
    accountId: string,
    title: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<any> {
    return db.inAppNotification.create({
      data: {
        accountId,
        title,
        content,
        metadata: (metadata as any) ?? undefined,
      },
    });
  }

  /**
   * Create an in-app notification for every staff account in the
   * organization that holds any of the given permissions (e.g. the admins
   * who should see "new video access request"). Unread count drives the
   * "🔴 طلبات جديدة" badge in the dashboard.
   */
  async createForStaff(
    organizationId: string,
    title: string,
    content: string,
    metadata?: Record<string, unknown>,
    permissionCodes: string[] = ['VIDEO_ACCESS_MANAGE'],
  ): Promise<number> {
    const staff = await db.account.findMany({
      where: {
        organizationId,
        kind: 'STAFF',
        deletedAt: null,
        status: 'ACTIVE',
        accountRoles: {
          some: {
            role: {
              rolePermissions: {
                some: {
                  permission: { code: { in: permissionCodes } },
                },
              },
            },
          },
        },
      },
      select: { id: true },
    });
    if (!staff.length) return 0;
    const data = staff.map((member) => ({
      accountId: member.id,
      title,
      content,
      metadata: (metadata as any) ?? undefined,
    }));
    const result = await db.inAppNotification.createMany({ data });
    return result.count;
  }

  async countUnread(accountId: string): Promise<number> {
    return db.inAppNotification.count({
      where: { accountId, readAt: null },
    });
  }
}
