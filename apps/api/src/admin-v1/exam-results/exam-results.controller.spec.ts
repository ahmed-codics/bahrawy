import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AdminV1ExamResultsController } from './exam-results.controller';
import { SessionAuthGuard } from '../../auth/session-auth.guard';
import { PermissionsGuard } from '../../rbac/permissions.guard';

describe('AdminV1ExamResultsController', () => {
  it('requires staff authentication and permission enforcement', () => {
    expect(
      Reflect.getMetadata(GUARDS_METADATA, AdminV1ExamResultsController),
    ).toEqual([SessionAuthGuard, PermissionsGuard]);
  });

  it('derives the tenant from the authenticated session, never from query input', async () => {
    const service = {
      list: jest.fn().mockResolvedValue({ items: [], meta: {} }),
    };
    const controller = new AdminV1ExamResultsController(service as never);
    const request = {
      account: {
        id: 'staff-1',
        organizationId: 'org-session',
        kind: 'STAFF',
      },
    };

    await controller.list(request as never, {
      search: 'سارة',
      gradeId: 'grade-1',
      assessmentId: 'assessment-1',
      page: 2,
      pageSize: 25,
    });

    expect(service.list).toHaveBeenCalledWith('org-session', {
      search: 'سارة',
      gradeId: 'grade-1',
      assessmentId: 'assessment-1',
      page: 2,
      pageSize: 25,
    });
  });
});
