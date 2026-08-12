import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { DeviceLeaseService } from '../device-lease/device-lease.service';
import { getSessionTokenFromCookies } from './session-cookie';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly deviceLeaseService: DeviceLeaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = getSessionTokenFromCookies(request);

    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new UnauthorizedException('Session token missing');
    }

    let session: any;
    try {
      session = await this.authService.validateSession(token);
    } catch (e: any) {
      throw new UnauthorizedException(e.message || 'Invalid session');
    }

    request.session = session;
    request.account = session.account;

    if (session.account.mustChangePassword) {
      const path = request.url || '';
      if (
        !path.includes('/auth/change-password') &&
        !path.includes('/auth/csrf-token') &&
        !path.includes('/auth/logout')
      ) {
        throw new UnauthorizedException('Password change required');
      }
    }

    await this.enforceStudentDevice(request, session);
    return true;
  }

  /**
   * Device lock enforcement on every authenticated student request: the
   * request must come from the device the session was bound to at login.
   * - Missing header: reject (no block, cannot attribute a device).
   * - Unbound session (pre-device-lock sessions): revoked, force re-login.
   * - Header differs from the bound device: the account is blocked.
   */
  private async enforceStudentDevice(request: any, session: any): Promise<void> {
    const account = session.account;
    if (!account || account.kind !== 'STUDENT') return;

    const path = request.url || '';
    // Always allow logging out / refreshing CSRF regardless of device state,
    // so clients can never get stuck unable to clear their session.
    if (path.includes('/auth/logout') || path.includes('/auth/csrf-token')) {
      return;
    }

    const header = request.headers['x-device-fingerprint'];
    const fingerprint =
      typeof header === 'string' ? header.trim() : '';
    if (!fingerprint) {
      throw new UnauthorizedException(
        'Device fingerprint header required (X-Device-Fingerprint)',
      );
    }

    if (!session.deviceFingerprint) {
      await this.authService.revokeSession(
        session.id,
        'DEVICE_REBIND_REQUIRED',
      );
      throw new UnauthorizedException(
        'Session is not bound to a device. Please log in again.',
      );
    }

    if (fingerprint !== session.deviceFingerprint) {
      await this.deviceLeaseService.blockAccountForDevice(
        account,
        fingerprint,
        'SESSION_DEVICE_MISMATCH',
      );
    }
  }
}