import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { CsrfService } from './csrf.service';
import { getSessionTokenFromCookies } from '../auth/session-cookie';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly csrfService: CsrfService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
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
