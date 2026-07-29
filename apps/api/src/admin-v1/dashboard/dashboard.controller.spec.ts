import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { REQUIRED_PERMISSION } from '../../rbac/permissions.decorator';
import { AdminV1DashboardController } from './dashboard.controller';

describe('AdminV1DashboardController', () => {
  it('uses the session organization for every authenticated staff role', async () => {
    const dashboardService = {
      getMetrics: jest.fn().mockResolvedValue({ activeStudents: 2 }),
    };
    const controller = new AdminV1DashboardController(dashboardService);
    const request = {
      account: {
        id: 'staff-1',
        organizationId: 'org-1',
        kind: 'STAFF',
      },
    };

    await expect(controller.getDashboard(request as never)).resolves.toEqual({
      activeStudents: 2,
    });
    expect(dashboardService.getMetrics).toHaveBeenCalledWith('org-1');
    expect(
      Reflect.getMetadata(
        REQUIRED_PERMISSION,
        AdminV1DashboardController.prototype.getDashboard,
      ),
    ).toBeUndefined();
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminV1DashboardController),
    ).toEqual([SessionAuthGuard]);
  });
});
