import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { DeviceLeaseService } from './device-lease.service';

@Injectable()
export class DeviceGuard implements CanActivate {
  constructor(private readonly deviceLeaseService: DeviceLeaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const account = request.account;
    if (account && account.kind === 'STUDENT') {
      const fingerprint = request.headers['x-device-fingerprint'];
      if (!fingerprint) {
        throw new BadRequestException(
          'Missing device fingerprint header (X-Device-Fingerprint)',
        );
      }
      const userAgent = request.headers['user-agent'];
      await this.deviceLeaseService.validateOrRegisterDevice(
        account.id,
        fingerprint,
        userAgent,
      );
      request.deviceFingerprint = fingerprint;
    }
    return true;
  }
}
