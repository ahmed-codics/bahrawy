import { Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { SecurityService } from '../security/security.service';

@Injectable()
export class TotpService {
  constructor(private readonly securityService: SecurityService) {
    authenticator.options = {
      window: 1, // small clock-skew window (1 step before/after = 30 seconds)
    };
  }

  generateSecret(accountEmail: string): { secret: string; otpauthUrl: string } {
    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(
      accountEmail,
      'Bahrawy Academy',
      secret,
    );
    return { secret, otpauthUrl };
  }

  encryptSecret(secret: string): string {
    return this.securityService.encrypt(secret);
  }

  decryptSecret(encryptedSecret: string): string {
    return this.securityService.decrypt(encryptedSecret);
  }

  generateRecoveryCodes(): { plainCodes: string[]; hashedCodes: string[] } {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];
    for (let i = 0; i < 10; i++) {
      // 16-character high-entropy alphanumeric string
      const plain = this.securityService.generateRandomToken().substring(0, 16);
      const hashed = this.securityService.hashOpaqueToken(plain);
      plainCodes.push(plain);
      hashedCodes.push(hashed);
    }
    return { plainCodes, hashedCodes };
  }

  verifyToken(secret: string, token: string): boolean {
    try {
      return authenticator.verify({ token, secret });
    } catch {
      return false;
    }
  }

  getCurrentStep(): number {
    return Math.floor(Date.now() / 1000 / 30);
  }
}
