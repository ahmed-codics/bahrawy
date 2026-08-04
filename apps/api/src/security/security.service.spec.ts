import { SecurityService } from './security.service';

describe('SecurityService', () => {
  let service: SecurityService;

  beforeEach(() => {
    service = new SecurityService();
  });

  describe('normalizePhone', () => {
    it('should normalize Egyptian mobile numbers starting with 01 to E.164 (+201...)', () => {
      expect(service.normalizePhone('01012345678')).toBe('+201012345678');
      expect(service.normalizePhone('01212345678')).toBe('+201212345678');
    });

    it('should handle E.164 already formatted strings', () => {
      expect(service.normalizePhone('+201112345678')).toBe('+201112345678');
    });

    it('should strip non-digits and normalize correctly', () => {
      expect(service.normalizePhone('015-1234-5678')).toBe('+201512345678');
    });
  });

  describe('generatePhoneHmac', () => {
    it('should generate same hash for same phone number regardless of formatting', () => {
      const hmac1 = service.generatePhoneHmac('01012345678');
      const hmac2 = service.generatePhoneHmac('010-1234-5678');
      const hmac3 = service.generatePhoneHmac('+201012345678');
      expect(hmac1).toBe(hmac2);
      expect(hmac1).toBe(hmac3);
    });
  });

  describe('encryption/decryption', () => {
    it('should encrypt and decrypt correctly', () => {
      const secretMsg = 'Sensitive Data 123';
      const enc = service.encrypt(secretMsg);
      expect(enc).not.toBe(secretMsg);
      const dec = service.decrypt(enc);
      expect(dec).toBe(secretMsg);
    });
  });

  describe('hashPassword / verifyPassword', () => {
    it('should hash and verify passwords using Argon2id', async () => {
      const pass = 'SuperSecurePassphrase123';
      const start = Date.now();
      const hash = await service.hashPassword(pass);
      const hashTime = Date.now() - start;
      console.log(`Argon2id Hash Time: ${hashTime}ms`);

      expect(hash).toContain('$argon2id$');

      const isMatch = await service.verifyPassword(hash, pass);
      expect(isMatch).toBe(true);

      const isWrongMatch = await service.verifyPassword(
        hash,
        'wrong_passphrase',
      );
      expect(isWrongMatch).toBe(false);
    });

    it('should reject short passwords', async () => {
      await expect(service.hashPassword('short')).rejects.toThrow();
    });

    it('should reject common passwords', async () => {
      await expect(service.hashPassword('password')).rejects.toThrow();
    });
  });
});
