import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { getSessionTokenFromCookies } from './session-cookie';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = getSessionTokenFromCookies(request);

    if (typeof token !== 'string' || token.trim().length === 0) {
      throw new UnauthorizedException('Session token missing');
    }
    try {
      const session = await this.authService.validateSession(token);
      request.session = session;
      request.account = session.account;
      if (session.account.mustChangePassword) {
        const path = request.url || '';
        if (
          !path.includes('/auth/change-password') &&
          !path.includes('/auth/logout')
        ) {
          throw new UnauthorizedException('Password change required');
        }
      }
      return true;
    } catch (e) {
      throw new UnauthorizedException(e.message || 'Invalid session');
    }
  }
}
