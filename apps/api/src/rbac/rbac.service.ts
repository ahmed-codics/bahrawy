import { Injectable } from '@nestjs/common';
import { db } from '@bahrawy/db';

export interface UserPermission {
  code: string;
  branchScopeId: string | null;
}

@Injectable()
export class RbacService {
  async getAccountPermissions(accountId: string): Promise<UserPermission[]> {
    const accountRoles = await db.accountRole.findMany({
      where: { accountId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    const list: UserPermission[] = [];
    for (const ar of accountRoles) {
      for (const rp of ar.role.rolePermissions) {
        list.push({
          code: rp.permission.code,
          branchScopeId: ar.branchScopeId,
        });
      }
    }
    return list;
  }

  async hasPermission(
    accountId: string,
    requiredPermission: string,
    branchId?: string,
  ): Promise<boolean> {
    const hasOwnerRole = await db.accountRole.findFirst({
      where: { accountId, role: { code: 'OWNER' } },
    });
    if (hasOwnerRole) {
      return true;
    }

    const permissions = await this.getAccountPermissions(accountId);
    return permissions.some((p) => {
      if (p.code !== requiredPermission) {
        return false;
      }
      if (!p.branchScopeId) {
        return true;
      }
      if (branchId && p.branchScopeId === branchId) {
        return true;
      }
      return false;
    });
  }
}
