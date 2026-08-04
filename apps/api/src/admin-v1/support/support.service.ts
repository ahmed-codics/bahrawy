import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { db } from '@bahrawy/db';
import { AdminAuditService } from '../common/services/audit.service';
import { ReplyTicketDto, UpdateTicketDto } from './support.dto';

type Actor = { id: string; organizationId: string };

@Injectable()
export class AdminV1SupportService {
  constructor(private readonly audit: AdminAuditService) {}

  async list(
    organizationId: string,
    status?: string,
    priority?: string,
    search?: string,
    page = 1,
    pageSize = 25,
  ) {
    const take = Math.min(Math.max(pageSize, 1), 100);
    const skip = Math.max(page - 1, 0) * take;
    const where = {
      organizationId,
      ...(status ? { status: status as any } : {}),
      ...(priority ? { priority: priority as any } : {}),
      ...(search
        ? {
            OR: [
              {
                subject: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                description: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
              {
                account: {
                  studentProfile: {
                    displayName: {
                      contains: search,
                      mode: 'insensitive' as const,
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      db.supportTicket.findMany({
        where,
        skip,
        take,
        orderBy: [
          { priority: 'desc' },
          { lastMessageAt: 'asc' },
          { createdAt: 'asc' },
        ],
        include: {
          account: {
            select: {
              studentProfile: { select: { id: true, displayName: true } },
            },
          },
          assignedStaff: { select: { id: true, displayName: true } },
          _count: { select: { messages: true } },
        },
      }),
      db.supportTicket.count({ where }),
    ]);
    return {
      items,
      meta: {
        page,
        pageSize: take,
        total,
        pageCount: Math.ceil(total / take),
      },
    };
  }

  async detail(organizationId: string, id: string) {
    const ticket = await db.supportTicket.findFirst({
      where: { id, organizationId },
      include: {
        account: {
          select: {
            studentProfile: { select: { id: true, displayName: true } },
          },
        },
        assignedStaff: { select: { id: true, displayName: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            authorAccount: {
              select: {
                studentProfile: { select: { displayName: true } },
                staffProfile: { select: { displayName: true } },
              },
            },
          },
        },
      },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    return ticket;
  }

  staff(organizationId: string) {
    return db.staffProfile.findMany({
      where: { account: { organizationId, status: 'ACTIVE', deletedAt: null } },
      orderBy: { displayName: 'asc' },
      select: { id: true, displayName: true },
    });
  }

  async update(actor: Actor, id: string, input: UpdateTicketDto) {
    const ticket = await db.supportTicket.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    if (ticket.version !== input.version) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'This ticket was changed by another staff member',
        currentVersion: ticket.version,
      });
    }
    if (input.assignedStaffId) {
      const staff = await db.staffProfile.findFirst({
        where: {
          id: input.assignedStaffId,
          account: { organizationId: actor.organizationId, status: 'ACTIVE' },
        },
      });
      if (!staff) throw new NotFoundException('Staff member not found');
    }
    const updated = await db.supportTicket.update({
      where: { id },
      data: {
        status: input.status,
        priority: input.priority,
        assignedStaffId:
          input.assignedStaffId === '' ? null : input.assignedStaffId,
        resolvedAt:
          input.status === 'RESOLVED'
            ? new Date()
            : input.status
              ? null
              : undefined,
        closedAt:
          input.status === 'CLOSED'
            ? new Date()
            : input.status
              ? null
              : undefined,
        version: { increment: 1 },
      },
    });
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: 'SUPPORT_TICKET_UPDATED',
      targetType: 'SUPPORT_TICKET',
      targetId: id,
      before: ticket,
      after: updated,
    });
    return updated;
  }

  async reply(actor: Actor, id: string, input: ReplyTicketDto) {
    const ticket = await db.supportTicket.findFirst({
      where: { id, organizationId: actor.organizationId },
    });
    if (!ticket) throw new NotFoundException('Support ticket not found');
    const now = new Date();
    const [message] = await db.$transaction([
      db.supportMessage.create({
        data: {
          ticketId: id,
          authorAccountId: actor.id,
          authorKind: 'STAFF',
          body: input.body,
          isInternal: input.isInternal ?? false,
        },
      }),
      db.supportTicket.update({
        where: { id },
        data: {
          lastMessageAt: now,
          studentUnreadAt: input.isInternal ? undefined : now,
          status:
            !input.isInternal && ticket.status === 'OPEN'
              ? 'WAITING_FOR_STUDENT'
              : undefined,
          version: { increment: 1 },
        },
      }),
    ]);
    await this.audit.logEvent({
      organizationId: actor.organizationId,
      actorType: 'STAFF',
      actorId: actor.id,
      action: input.isInternal
        ? 'SUPPORT_INTERNAL_NOTE_ADDED'
        : 'SUPPORT_REPLY_SENT',
      targetType: 'SUPPORT_TICKET',
      targetId: id,
      after: { messageId: message.id },
    });
    return message;
  }
}
