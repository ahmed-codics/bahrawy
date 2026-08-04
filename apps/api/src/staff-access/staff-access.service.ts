import { Injectable, UnauthorizedException } from '@nestjs/common';
import { env } from '@bahrawy/config';
import { db } from '@bahrawy/db';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwks = createRemoteJWKSet(
  new URL(
    `https://${env.CLOUDFLARE_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`,
  ),
);

@Injectable()
export class StaffAccessService {
  async authenticateAssertion(
    assertion: string | undefined,
    mockSubject?: string,
  ): Promise<string> {
    await Promise.resolve();
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      if (!assertion) {
        throw new UnauthorizedException('Missing Cloudflare Access assertion');
      }
      try {
        const { payload } = await jwtVerify(assertion, jwks, {
          issuer: `https://${env.CLOUDFLARE_ACCESS_TEAM_DOMAIN}`,
          audience: env.CLOUDFLARE_ACCESS_AUDIENCE,
          algorithms: ['RS256'],
        });
        if (!payload.sub || typeof payload.sub !== 'string') {
          throw new Error('Missing subject');
        }
        return payload.sub;
      } catch (e) {
        throw new UnauthorizedException(
          `Invalid Cloudflare Access assertion: ${e.message}`,
        );
      }
    } else {
      if (mockSubject) {
        return mockSubject;
      }
      if (assertion) {
        try {
          const parts = assertion.split('.');
          const payload = JSON.parse(
            Buffer.from(parts[1], 'base64').toString('utf8'),
          );
          return payload.sub;
        } catch {
          return 'mock-subject-dev';
        }
      }
      return 'mock-subject-dev';
    }
  }

  async resolveStaffAccount(subject: string) {
    const accessIdentity = await db.staffAccessIdentity.findFirst({
      where: {
        provider: 'CLOUDFLARE_ACCESS',
        subject,
      },
      include: {
        account: {
          include: {
            staffProfile: true,
          },
        },
      },
    });
    if (
      !accessIdentity ||
      !accessIdentity.account ||
      accessIdentity.account.kind !== 'STAFF'
    ) {
      throw new UnauthorizedException(
        'Access identity not linked to any staff account',
      );
    }
    return accessIdentity.account;
  }
}
