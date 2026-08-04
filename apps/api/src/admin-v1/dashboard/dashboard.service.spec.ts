import { db } from '@bahrawy/db';
import { AdminV1DashboardService } from './dashboard.service';

jest.mock('@bahrawy/db', () => ({
  db: {
    account: { count: jest.fn() },
    paymentOrder: { count: jest.fn() },
    supportTicket: { count: jest.fn() },
    course: { count: jest.fn() },
  },
}));

describe('AdminV1DashboardService', () => {
  it('scopes every metric to the authenticated organization', async () => {
    (db.account.count as jest.Mock).mockResolvedValue(12);
    (db.paymentOrder.count as jest.Mock).mockResolvedValue(3);
    (db.supportTicket.count as jest.Mock).mockResolvedValue(4);
    (db.course.count as jest.Mock).mockResolvedValue(5);

    const result = await new AdminV1DashboardService().getMetrics('org-1');

    expect(result).toEqual({
      activeStudents: 12,
      pendingPayments: 3,
      openTickets: 4,
      liveCourses: 5,
    });
    expect(db.account.count).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        kind: 'STUDENT',
        status: 'ACTIVE',
      },
    });
    expect(db.paymentOrder.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', status: 'PENDING_REVIEW' },
    });
    expect(db.supportTicket.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', status: 'OPEN' },
    });
    expect(db.course.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', status: 'PUBLISHED' },
    });
  });
});
