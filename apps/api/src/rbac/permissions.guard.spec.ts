import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { RbacService } from './rbac.service';

function createContext(account = { id: 'staff-1' }) {
  return {
    getHandler: () => 'handler',
    getClass: () => 'controller',
    switchToHttp: () => ({
      getRequest: () => ({
        account,
        params: {},
        query: {},
        body: {},
      }),
    }),
  } as never;
}

describe('PermissionsGuard', () => {
  it('requires every permission declared on an endpoint', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['A', 'B']),
    };
    const rbacService = {
      hasPermission: jest
        .fn()
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false),
    };
    const guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      rbacService as unknown as RbacService,
    );

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(rbacService.hasPermission).toHaveBeenCalledTimes(2);
  });

  it('allows an endpoint with no permission metadata', async () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    };
    const rbacService = { hasPermission: jest.fn() };
    const guard = new PermissionsGuard(
      reflector as unknown as Reflector,
      rbacService as unknown as RbacService,
    );

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(rbacService.hasPermission).not.toHaveBeenCalled();
  });
});
