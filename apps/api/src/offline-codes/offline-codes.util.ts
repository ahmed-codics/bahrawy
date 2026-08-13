import * as crypto from 'crypto';

// 32-char alphabet excluding ambiguous characters (0/O/1/I/L)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GROUP_SIZE = 4;
const GROUP_COUNT = 3;

export function normalizeOfflineCode(input: string): string {
  return input.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function generateOfflineCode(): string {
  const chars = new Array<string>(GROUP_SIZE * GROUP_COUNT);
  for (let i = 0; i < chars.length; i += 1) {
    const byte = crypto.randomBytes(1)[0];
    chars[i] = ALPHABET[byte % ALPHABET.length];
  }
  const groups: string[] = [];
  for (let i = 0; i < GROUP_COUNT; i += 1) {
    groups.push(chars.slice(i * GROUP_SIZE, (i + 1) * GROUP_SIZE).join(''));
  }
  return groups.join('-');
}

export function offlineCodePrefix(normalizedCode: string): string {
  return normalizedCode.slice(0, GROUP_SIZE);
}

export function maskOfflineCode(normalizedCode: string): string {
  const prefix = offlineCodePrefix(normalizedCode);
  return `${prefix}-****-****`;
}
