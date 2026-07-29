import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import { StaffPermission } from '@bahrawy/types';

@Controller('dashboard')
@UseGuards(SessionAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('student')
  async getStudentDashboard(@Req() req: any) {
    if (req.account.kind !== 'STUDENT') {
      throw new UnauthorizedException('Not a student account');
    }
    const data = await this.dashboardService.getStudentDashboard(
      req.account.id,
    );
    return { status: 'SUCCESS', data };
  }

  @Get('student/profile')
  async getStudentProfile(@Req() req: any) {
    if (req.account.kind !== 'STUDENT') {
      throw new UnauthorizedException('Not a student account');
    }
    const data = await this.dashboardService.getStudentProfile(req.account.id);
    return { status: 'SUCCESS', data };
  }

  @Put('student/profile')
  async updateStudentProfile(
    @Req() req: any,
    @Body()
    body: {
      gradeId: string;
      schoolName?: string | null;
      city?: string | null;
      gender?: 'MALE' | 'FEMALE' | null;
    },
  ) {
    if (req.account.kind !== 'STUDENT') {
      throw new UnauthorizedException('Not a student account');
    }
    const data = await this.dashboardService.updateStudentProfile(
      req.account.id,
      body,
    );
    return { status: 'SUCCESS', data };
  }

  @Get('guardian')
  async getGuardianDashboard(@Req() req: any) {
    if (req.account.kind !== 'GUARDIAN') {
      throw new UnauthorizedException('Not a guardian account');
    }
    const data = await this.dashboardService.getGuardianDashboard(
      req.account.id,
    );
    return { status: 'SUCCESS', data };
  }

  @Get('staff')
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermission.STAFF_MANAGE)
  async getStaffDashboard() {
    const data = await this.dashboardService.getStaffDashboard();
    return { status: 'SUCCESS', data };
  }

  @Get('staff/students')
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermission.STUDENT_MANAGE)
  async getStaffStudents(@Query('gradeId') gradeId?: string) {
    const data = await this.dashboardService.getStaffStudents(gradeId);
    return { status: 'SUCCESS', data };
  }

  @Post('staff/students')
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermission.STUDENT_MANAGE)
  async createStaffStudent(@Body() body: any) {
    const data = await this.dashboardService.createStaffStudent(body);
    return { status: 'SUCCESS', data };
  }

  @Get('staff/students/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermission(StaffPermission.STUDENT_MANAGE)
  async getStaffStudent(@Param('id') id: string) {
    const data = await this.dashboardService.getStaffStudent(id);
    return { status: 'SUCCESS', data };
  }
}
