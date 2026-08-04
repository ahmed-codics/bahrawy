import { ForbiddenException } from '@nestjs/common';
import { db } from '@bahrawy/db';
import { SecurityService } from '../../security/security.service';
import { AdminAuditService } from '../common/services/audit.service';
import { AdminV1ManagementService } from './management.service';

jest.mock('@bahrawy/db', () => ({
  db: {
    staffProfile: { findFirst: jest.fn() },
    role: { findUnique: jest.fn(), count: jest.fn() },
  },
}));

describe('AdminV1ManagementService', () => {
  const service = new AdminV1ManagementService(
    {} as SecurityService,
    { logEvent: jest.fn() } as unknown as AdminAuditService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('prevents an administrator from suspending their own account', async () => {
    (db.staffProfile.findFirst as jest.Mock).mockResolvedValue({
      id: 'profile-1',
      accountId: 'staff-1',
      account: {
        id: 'staff-1',
        status: 'ACTIVE',
        version: 1,
        accountRoles: [{ roleId: 'owner-role', role: { code: 'OWNER' } }],
      },
    });

    await expect(
      service.updateStaff(
        { id: 'staff-1', organizationId: 'org-1' },
        'profile-1',
        {
          status: 'SUSPENDED',
          roleIds: ['owner-role'],
          reason: 'Testing lockout protection',
          version: 1,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
