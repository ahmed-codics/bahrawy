import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '../throttle/throttle.decorator';
import { ThrottleGuard } from '../throttle/throttle.guard';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './session-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { RequirePermission } from '../rbac/permissions.decorator';
import {
  getSessionCookieName,
  SESSION_COOKIE_OPTIONS,
  SESSION_COOKIE_NAMES,
} from './session-cookie';
import { db } from '@bahrawy/db';
import { StaffPermission } from '@bahrawy/types';
import { RbacService } from '../rbac/rbac.service';
import { CsrfService } from '../csrf/csrf.service';
import { getSessionTokenFromCookies } from './session-cookie';
import { RegisterStudentDto } from './register.dto';
import { StaffLoginDto } from './staff-login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly rbacService: RbacService,
    private readonly csrfService: CsrfService,
  ) {}

  private setSessionCookie(req: Request, res: Response, token: string) {
    res.cookie(getSessionCookieName(req), token, SESSION_COOKIE_OPTIONS);
  }

  private clearSessionCookie(req: Request, res: Response) {
    for (const name of SESSION_COOKIE_NAMES) {
      res.clearCookie(name, SESSION_COOKIE_OPTIONS);
    }
  }

  @Post('check-phone')
  @UseGuards(ThrottleGuard)
  @Throttle(30, 900_000)
  checkPhone() {
    return { available: true };
  }

  @Post('register')
  @UseGuards(ThrottleGuard)
  @Throttle(3, 3_600_000)
  async register(
    @Body() body: RegisterStudentDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { account, session } = await this.authService.registerStudent(body);
    this.setSessionCookie(req, res, session.plainToken);
    return {
      status: 'SUCCESS',
      accountId: account.id,
      kind: account.kind,
    };
  }

  @Post('activate')
  @UseGuards(ThrottleGuard)
  @Throttle(5, 900_000)
  async activate(
    @Body() body: { phone: string; credentialCode: string; password: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { account, session } = await this.authService.activate(
      body.phone,
      body.credentialCode,
      body.password,
    );
    this.setSessionCookie(req, res, session.plainToken);
    return { status: 'SUCCESS', accountId: account.id, kind: account.kind };
  }

  @Post('login')
  @UseGuards(ThrottleGuard)
  @Throttle(10, 900_000)
  async login(
    @Body() body: { phone: string; password: string; totpToken?: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const { account, session } = await this.authService.login(
      body.phone,
      body.password,
      body.totpToken,
      ipAddress,
      userAgent,
    );
    this.setSessionCookie(req, res, session.plainToken);
    return {
      status: 'SUCCESS',
      accountId: account.id,
      kind: account.kind,
      mustChangePassword: account.mustChangePassword,
    };
  }

  @Post('staff-login')
  @UseGuards(ThrottleGuard)
  @Throttle(10, 900_000)
  async staffLogin(
    @Body() body: StaffLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip;
    const userAgent = req.headers['user-agent'];
    const { account, session } = await this.authService.staffLogin(
      body.email,
      body.password,
      body.totpToken,
      ipAddress,
      userAgent,
    );
    this.setSessionCookie(req, res, session.plainToken);
    return {
      status: 'SUCCESS',
      accountId: account.id,
      kind: account.kind,
      mustChangePassword: account.mustChangePassword,
    };
  }

  @Post('logout')
  @UseGuards(SessionAuthGuard)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const session = req.session;
    await this.authService.revokeSession(session.id, 'USER_LOGOUT');
    this.clearSessionCookie(req, res);
    return { status: 'SUCCESS' };
  }

  @Post('logout-all')
  @UseGuards(SessionAuthGuard)
  async logoutAll(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    const account = req.account;
    await this.authService.revokeAllSessions(account.id, 'USER_LOGOUT_ALL');
    this.clearSessionCookie(req, res);
    return { status: 'SUCCESS' };
  }

  @Post('change-password')
  @UseGuards(SessionAuthGuard)
  async changePassword(
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
    @Body()
    body: {
      oldPasswordAr?: string;
      newPasswordAr?: string;
      oldPassword?: string;
      newPassword?: string;
    },
  ) {
    const account = req.account;
    await this.authService.changePassword(
      account.id,
      body.oldPasswordAr ?? body.oldPassword ?? '',
      body.newPasswordAr ?? body.newPassword ?? '',
    );
    this.clearSessionCookie(req, res);
    return { status: 'SUCCESS' };
  }

  @Post('staff/recovery-case')
  @UseGuards(SessionAuthGuard, PermissionsGuard)
  @RequirePermission(StaffPermission.STAFF_MANAGE)
  async createRecoveryCase(
    @Req() req: any,
    @Body() body: { targetAccountId: string; reason: string; checklist: any },
  ) {
    const staff = req.account;
    const { resetCase, plainCredential } =
      await this.authService.createPasswordResetCase(
        staff.id,
        body.targetAccountId,
        body.reason,
        body.checklist,
      );
    return {
      status: 'SUCCESS',
      caseId: resetCase.id,
      resetCode: plainCredential,
    };
  }

  @Post('staff/recovery-consume')
  @UseGuards(ThrottleGuard)
  @Throttle(5, 900_000)
  async consumeRecoveryCase(
    @Body() body: { caseId: string; resetCode: string; newPasswordAr: string },
  ) {
    await this.authService.consumePasswordResetCase(
      body.caseId,
      body.resetCode,
      body.newPasswordAr,
    );
    return { status: 'SUCCESS' };
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  async getSession(@Req() req: any) {
    const account = req.account;
    const profile = await db.account.findUnique({
      where: { id: account.id },
      select: {
        id: true,
        kind: true,
        studentProfile: { select: { id: true, displayName: true } },
        guardianProfile: { select: { id: true, displayName: true } },
        staffProfile: { select: { id: true, displayName: true } },
        accountRoles: {
          select: { role: { select: { code: true, description: true } } },
        },
      },
    });
    const activeProfile =
      profile?.studentProfile ??
      profile?.guardianProfile ??
      profile?.staffProfile;
    const permissions =
      account.kind === 'STAFF'
        ? (await this.rbacService.getAccountPermissions(account.id)).map(
            (permission) => permission.code,
          )
        : [];
    return {
      status: 'SUCCESS',
      data: {
        accountId: account.id,
        profileId: activeProfile?.id ?? null,
        role: account.kind,
        roles:
          profile?.accountRoles.map((assignment) => assignment.role.code) ?? [],
        kind: account.kind,
        name: activeProfile?.displayName ?? '',
        mustChangePassword: account.mustChangePassword,
        status: account.status,
        permissions: [...new Set(permissions)],
      },
    };
  }

  @Get('staff/me')
  @UseGuards(SessionAuthGuard)
  async getStaffSession(@Req() req: any) {
    if (req.account.kind !== 'STAFF') {
      throw new UnauthorizedException('Not a staff account');
    }
    return this.getSession(req);
  }

  @Get('csrf-token')
  @UseGuards(SessionAuthGuard)
  getCsrfToken(@Req() req: any) {
    const sessionToken = getSessionTokenFromCookies(req);
    if (!sessionToken) {
      throw new UnauthorizedException('No session token found');
    }
    const csrfToken = this.csrfService.generate(sessionToken);
    return { csrfToken };
  }
}
