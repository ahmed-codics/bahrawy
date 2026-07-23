import { TotpService } from './totp.service';
import { SecurityService } from '../security/security.service';
import { authenticator } from 'otplib';

describe('TotpService', () => {
  let totpService: TotpService;
  let securityService: SecurityService;

  beforeEach(() => {
    securityService = new SecurityService();
    totpService = new TotpService(securityService);
  });

  describe('generateSecret', () => {
    it('should generate valid secret and otpauth url', () => {
      const { secret, otpauthUrl } =
        totpService.generateSecret('staff@bahrawy.com');
      expect(secret).toBeDefined();
      expect(otpauthUrl).toContain('staff%40bahrawy.com');
    });
  });

  describe('recoveryCodes', () => {
    it('should generate 10 hashed and plain recovery codes', () => {
      const { plainCodes, hashedCodes } = totpService.generateRecoveryCodes();
      expect(plainCodes.length).toBe(10);
      expect(hashedCodes.length).toBe(10);
      expect(hashedCodes[0]).toBe(
        securityService.hashOpaqueToken(plainCodes[0]),
      );
    });
  });

  describe('verifyToken', () => {
    it('should verify correct TOTP token', () => {
      const { secret } = totpService.generateSecret('staff@bahrawy.com');
      const token = authenticator.generate(secret);
      expect(totpService.verifyToken(secret, token)).toBe(true);
      expect(totpService.verifyToken(secret, '000000')).toBe(false);
    });
  });
});
