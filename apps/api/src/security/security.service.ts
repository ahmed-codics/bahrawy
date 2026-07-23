import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as argon2 from 'argon2';
import { env } from '@bahrawy/config';

@Injectable()
export class SecurityService {
  private readonly encryptionKey: Buffer;
  private readonly hmacKey: Buffer;

  constructor() {
    const rawEncKey = env.ENCRYPTION_KEY;
    const rawHmacKey = env.HMAC_KEY;

    if (rawEncKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(rawEncKey)) {
      throw new Error(
        'FATAL: ENCRYPTION_KEY must be exactly 64 hex characters (no fallback to weak key)',
      );
    }
    this.encryptionKey = Buffer.from(rawEncKey, 'hex');

    if (rawHmacKey.length !== 64 || !/^[0-9a-fA-F]{64}$/.test(rawHmacKey)) {
      throw new Error(
        'FATAL: HMAC_KEY must be exactly 64 hex characters (no fallback to weak key)',
      );
    }
    this.hmacKey = Buffer.from(rawHmacKey, 'hex');
  }

  // Normalize Egyptian mobile numbers to E.164
  normalizePhone(phone: string): string {
    const clean = phone.replace(/\D/g, '');
    if (clean.startsWith('01') && clean.length === 11) {
      return `+20${clean.substring(1)}`;
    }
    if (clean.startsWith('201') && clean.length === 12) {
      return `+${clean}`;
    }
    if (clean.startsWith('1') && clean.length === 10) {
      return `+20${clean}`;
    }
    if (!phone.startsWith('+')) {
      return `+${clean}`;
    }
    return `+${clean}`;
  }

  // Keyed HMAC for phone lookup
  generatePhoneHmac(phone: string): string {
    const normalized = this.normalizePhone(phone);
    return crypto
      .createHmac('sha256', this.hmacKey)
      .update(normalized)
      .digest('hex');
  }

  // Keyed HMAC for email lookup
  generateEmailHmac(email: string): string {
    const normalized = email.trim().toLowerCase();
    return crypto
      .createHmac('sha256', this.hmacKey)
      .update(normalized)
      .digest('hex');
  }

  // AES-256-GCM encryption
  encrypt(text: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  // AES-256-GCM decryption
  decrypt(encryptedText: string): string {
    try {
      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
      }
      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = Buffer.from(parts[2], 'hex');
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.encryptionKey,
        iv,
      );
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('Failed to decrypt data');
    }
  }

  // Password Hashing using Argon2id with 64 MiB memory, 3 iterations, 1 parallelism
  async hashPassword(password: string): Promise<string> {
    if (!password || password.length < 8 || password.length > 128) {
      throw new BadRequestException(
        'Password must be between 8 and 128 characters long',
      );
    }
    if (this.isCommonPassword(password)) {
      throw new BadRequestException('Password is too common and easily guessed');
    }
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private isCommonPassword(password: string): boolean {
    const common = [
      'password',
      '12345678',
      '123456789',
      'qwertyuiop',
      '1234567890',
      'sunshine',
      'princess',
      'football',
      'shadow12',
      'welcome1',
    ];
    return common.includes(password.toLowerCase().trim());
  }

  // Cryptographically random 256-bit token
  generateRandomToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Hash an opaque token with SHA-256 and HMAC key
  hashOpaqueToken(token: string): string {
    return crypto
      .createHmac('sha256', this.hmacKey)
      .update(token)
      .digest('hex');
  }
}
