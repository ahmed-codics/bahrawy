import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSION = 'required_permission';
export const RequirePermission = (...permissions: string[]) =>
  SetMetadata(REQUIRED_PERMISSION, permissions);
