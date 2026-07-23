import { Injectable } from '@nestjs/common';
import { env } from '@bahrawy/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class CsrfService {
  generate(sessionCookieToken: string): string {
    return createHmac('sha256', env.HMAC_KEY)
      .update(sessionCookieToken)
      .digest('hex');
  }

  validate(sessionCookieToken: string, csrfToken: string): boolean {
    const expected = this.generate(sessionCookieToken);
    const expectedBuf = Buffer.from(expected);
    const actualBuf = Buffer.from(csrfToken);
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }
}
