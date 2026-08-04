import { StaffPermission } from '@bahrawy/types';
import { RequirePermission } from '../../../rbac/permissions.decorator';

export const RequireAdminPermission = (...permissions: StaffPermission[]) =>
  RequirePermission(...permissions);
