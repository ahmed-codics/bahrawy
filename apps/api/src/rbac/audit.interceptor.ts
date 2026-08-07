import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { db, Prisma } from '@bahrawy/db';
import { AdminAuditService } from '../admin-v1/common/services/audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AdminAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, account } = request;

    // Only audit mutations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Ensure it's a staff account mutating
    if (!account || account.kind !== 'STAFF') {
      return next.handle();
    }

    return next.handle().pipe(
      tap((response) => {
        void (async () => {
          try {
            await db.auditEvent.create({
              data: {
                organizationId: account.organizationId,
                actorType: 'STAFF',
                actorId: account.id,
                action: `${method} ${url}`,
                targetType: 'API_RESPONSE',
                targetId: 'UNKNOWN', // Hard to determine generically without conventions
                before: {},
                after: this.auditService.redactSensitive({
                  requestBody: body,
                  response,
                }) as Prisma.InputJsonValue,
                reason: 'Admin API Mutation',
              },
            });
          } catch (e) {
            this.logger.error('Failed to log audit event', e);
          }
        })();
      }),
    );
  }
}
