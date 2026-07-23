import { Injectable } from '@nestjs/common';
import { db } from '@bahrawy/db';

@Injectable()
export class AdminV1DashboardService {
  async getMetrics(organizationId: string) {
    const [activeStudents, pendingPayments, openTickets, liveCourses] =
      await Promise.all([
        db.account.count({
          where: { organizationId, kind: 'STUDENT', status: 'ACTIVE' },
        }),
        db.paymentOrder.count({
          where: { organizationId, status: 'PENDING_REVIEW' },
        }),
        db.supportTicket.count({
          where: { organizationId, status: 'OPEN' },
        }),
        db.course.count({
          where: { organizationId, status: 'PUBLISHED' },
        }),
      ]);

    return {
      activeStudents,
      pendingPayments,
      openTickets,
      liveCourses,
    };
  }
}
