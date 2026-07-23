import { Injectable, NotFoundException } from '@nestjs/common';
import { db } from '@bahrawy/db';

@Injectable()
export class SupportService {
  async getTickets(accountId: string, isStaff = false): Promise<any[]> {
    const where = isStaff ? {} : { accountId };
    return db.supportTicket.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTicket(
    ticketId: string,
    accountId: string,
    isStaff = false,
  ): Promise<any> {
    const ticket = await db.supportTicket.findUnique({
      where: { id: ticketId },
    });
    if (!ticket || (!isStaff && ticket.accountId !== accountId)) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  async createTicket(
    accountId: string,
    organizationId: string,
    subject: string,
    description: string,
  ): Promise<any> {
    return db.supportTicket.create({
      data: {
        accountId,
        organizationId,
        subject,
        description,
        status: 'OPEN',
      },
    });
  }

  // Simplified reply logic (just append to description for now since there is no TicketMessage model)
  async replyToTicket(
    ticketId: string,
    accountId: string,
    message: string,
    isStaff = false,
  ): Promise<any> {
    const ticket = await this.getTicket(ticketId, accountId, isStaff);
    const prefix = isStaff ? 'Staff' : 'User';
    const newDescription = `${ticket.description}\n\n[${prefix} Reply]: ${message}`;
    return db.supportTicket.update({
      where: { id: ticketId },
      data: {
        description: newDescription,
        status: isStaff ? 'RESOLVED' : 'OPEN',
      },
    });
  }
}
