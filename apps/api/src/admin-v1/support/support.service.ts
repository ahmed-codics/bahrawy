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

  list(
    organizationId: string,
    status?: string,
    priority?: string,
    search?: string,
  ) {
    return db.supportTicket.findMany({
      where: {
        organizationId,
        ...(status ? { status: status as any } : {}),
        ...(priority ? { priority: priority as any } : {}),
        ...(search
          ? {
              OR: [
                { subject: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
                {
                  account: {
                    studentProfile: {
                      displayName: { contains: search, mode: 'insensitive' },
                    },
                  },
                },
              ],
            }
          : {}),
      },
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
    });
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
