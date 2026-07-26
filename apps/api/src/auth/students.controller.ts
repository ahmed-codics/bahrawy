import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { SessionAuthGuard } from './session-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { SecurityService } from '../security/security.service';
import { StaffPermission } from '@bahrawy/types';

@Controller('staff/students')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermission(StaffPermission.STUDENT_MANAGE)
export class StudentsController {
  constructor(private readonly securityService: SecurityService) {}

  @Get()
  async listStudents(
    @Query('search') search = '',
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    const take = Math.min(Number(limit) || 20, 100);
    const skip = Math.max((Number(page) || 1) - 1, 0) * take;
    const phoneHmac = search.startsWith('01')
      ? this.securityService.generatePhoneHmac(search)
      : undefined;

    const where = {
      account: {
        deletedAt: null,
        ...(phoneHmac ? { phoneHmac } : {}),
      },
      ...(search && !phoneHmac
        ? { displayName: { contains: search, mode: 'insensitive' as const } }
        : {}),
    };

    const [students, total] = await Promise.all([
      db.studentProfile.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          account: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              devices: { select: { id: true } },
            },
          },
        },
      }),
      db.studentProfile.count({ where }),
    ]);

    return {
      status: 'SUCCESS',
      data: {
        total,
        page: Number(page) || 1,
        limit: take,
        students: students.map((student: any) => ({
          id: student.id,
          accountId: student.accountId,
          displayName: student.displayName,
          phone: 'HIDDEN',
          status: student.account.status,
          deviceCount: student.account.devices.length,
          createdAt: student.account.createdAt,
        })),
      },
    };
  }

  @Get(':studentId')
  async getStudent(@Param('studentId') studentId: string) {
    const student = await db.studentProfile.findUnique({
      where: { id: studentId },
      include: {
        account: {
          include: {
            devices: true,
            entitlements: { include: { product: true } },
          },
        },
      },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }

    let phone = 'HIDDEN';
    try {
      if (student.account.phoneEncrypted) {
        phone = this.securityService.decrypt(student.account.phoneEncrypted);
      }
    } catch {
      phone = 'HIDDEN';
    }

    const payments = await db.paymentOrder.findMany({
      where: { accountId: student.accountId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      status: 'SUCCESS',
      data: {
        id: student.id,
        accountId: student.accountId,
        displayName: student.displayName,
        phone,
        status: student.account.status,
        createdAt: student.createdAt,
        devices: student.account.devices,
        enrollments: student.account.entitlements,
        payments,
      },
    };
  }

  @Post(':studentId/suspend')
  async suspendStudent(@Param('studentId') studentId: string) {
    const student = await db.studentProfile.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    await db.account.update({
      where: { id: student.accountId },
      data: { status: 'SUSPENDED' },
    });
    return { status: 'SUCCESS' };
  }

  @Post(':studentId/reinstate')
  async reinstateStudent(@Param('studentId') studentId: string) {
    const student = await db.studentProfile.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    await db.account.update({
      where: { id: student.accountId },
      data: { status: 'ACTIVE' },
    });
    return { status: 'SUCCESS' };
  }

  @Delete(':studentId/devices/:id')
  async revokeDevice(
    @Param('studentId') studentId: string,
    @Param('id') deviceId: string,
  ) {
    const student = await db.studentProfile.findUnique({
      where: { id: studentId },
    });
    if (!student) {
      throw new NotFoundException('Student not found');
    }
    await db.studentDevice
      .delete({
        where: {
          accountId_deviceFingerprint: {
            accountId: student.accountId,
            deviceFingerprint: deviceId,
          },
        },
      })
      .catch(async () => {
        await db.studentDevice.delete({ where: { id: deviceId } });
      });
    return { status: 'SUCCESS' };
  }
}
