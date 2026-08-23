import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';

/**
 * Extracts and normalizes the x-device-fingerprint header for STUDENT
 * requests on device-sensitive routes (catalog/video). Actual device
 * enforcement (single-device lock + session binding) happens at login
 * (AuthService) and on every authenticated student request (SessionAuthGuard).
 */
@Injectable()
export class DeviceGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const account = request.account;
    if (account && account.kind === 'STUDENT') {
      const header = request.headers['x-device-fingerprint'];
      const fingerprint = typeof header === 'string' ? header.trim() : '';
      if (!fingerprint) {
        throw new BadRequestException(
          'Missing device fingerprint header (X-Device-Fingerprint)',
        );
      }
      request.deviceFingerprint = fingerprint;
    }
    return true;
  }
}
