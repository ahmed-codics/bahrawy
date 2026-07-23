import { Injectable } from '@nestjs/common';
import { db, Prisma } from '@bahrawy/db';

const SENSITIVE_KEYS = new Set([
  'password',
  'oldpassword',
  'oldpasswordar',
  'newpassword',
  'newpasswordar',
  'temporarypassword',
  'passwordhash',
  'token',
  'tokenhash',
  'authorization',
  'secret',
  'secretencrypted',
  'phoneencrypted',
  'emailencrypted',
  'phone',
  'credentialhash',
  'credentialcode',
  'activationcode',
  'recoverycode',
  'plaincredential',
  'resetcode',
  'totptoken',
  'filecontent',
  'cookie',
  'cookies',
]);

@Injectable()
export class AdminAuditService {
  public redactSensitive(payload: unknown): unknown {
    if (typeof payload === 'bigint') {
      return payload.toString();
    }

    if (!payload || typeof payload !== 'object') {
      return payload;
    }

    if (payload instanceof Date) {
      return payload.toISOString();
    }

    const serializable = payload as { toJSON?: () => unknown };
    if (typeof serializable.toJSON === 'function') {
      return this.redactSensitive(serializable.toJSON());
    }

    if (Array.isArray(payload)) {
      return payload.map((item) => this.redactSensitive(item));
    }

    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      payload as Record<string, unknown>,
    )) {
      if (typeof value === 'function' || typeof value === 'undefined') continue;
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        redacted[key] = '[REDACTED]';
      } else {
        redacted[key] = this.redactSensitive(value);
      }
    }
    return redacted;
  }

  async logEvent(params: {
    organizationId: string;
    actorType: 'SYSTEM' | 'STAFF' | 'STUDENT';
    actorId?: string;
    action: string;
    targetType: string;
    targetId: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    traceId?: string;
  }) {
    const beforeRedacted = params.before
      ? this.redactSensitive(params.before)
      : null;
    const afterRedacted = params.after
      ? this.redactSensitive(params.after)
      : null;

    return db.auditEvent.create({
      data: {
        organizationId: params.organizationId,
        actorType: params.actorType,
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        before:
          beforeRedacted === null
            ? Prisma.JsonNull
            : (beforeRedacted as Prisma.InputJsonValue),
        after:
          afterRedacted === null
            ? Prisma.JsonNull
            : (afterRedacted as Prisma.InputJsonValue),
        reason: params.reason,
        traceId: params.traceId,
      },
    });
  }
}
