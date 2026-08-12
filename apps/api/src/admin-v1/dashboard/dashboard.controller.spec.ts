import { GUARDS_METADATA } from '@nestjs/common/constants';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';
import { REQUIRED_PERMISSION } from '../../rbac/permissions.decorator';
import { StaffPermission } from '@bahrawy/types';
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
  });

  it('enforces org-wide module permissions via RBAC', () => {
    expect(
      Reflect.getMetadata(REQUIRED_PERMISSION, AdminV1DashboardController),
    ).toEqual([
      StaffPermission.PAYMENT_MANAGE,
      StaffPermission.SUPPORT_MANAGE,
      StaffPermission.CATALOG_MANAGE,
      StaffPermission.STUDENT_MANAGE,
      StaffPermission.ASSESSMENT_MANAGE,
    ]);
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminV1DashboardController),
    ).toEqual([SessionAuthGuard, PermissionsGuard]);
  });
});
