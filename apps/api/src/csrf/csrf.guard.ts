import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { CsrfService } from './csrf.service';
import { getSessionTokenFromCookies } from '../auth/session-cookie';

const EXEMPT_PATHS = new Set([
  '/auth/login',
  '/auth/staff-login',
  '/auth/register',
  '/auth/activate',
  '/auth/check-phone',
  '/auth/staff/recovery-consume',
]);

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrfService: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    const path = (request.originalUrl || request.url).split('?')[0];
    if (EXEMPT_PATHS.has(path)) {
      return true;
    }

    const sessionToken = getSessionTokenFromCookies(request);
    if (!sessionToken) {
      return true;
    }

    const csrfToken = request.headers['x-csrf-token'];
    if (!csrfToken || typeof csrfToken !== 'string') {
      throw new ForbiddenException('Missing CSRF token');
    }

    if (!this.csrfService.validate(sessionToken, csrfToken)) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }
}
