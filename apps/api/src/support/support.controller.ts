import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { SessionAuthGuard } from '../auth/session-auth.guard';

@Controller('support')
@UseGuards(SessionAuthGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  async getTickets(@Req() req: any) {
    const isStaff = req.account.kind === 'STAFF';
    const data = await this.supportService.getTickets(req.account.id, isStaff);
    return { status: 'SUCCESS', data };
  }

  @Post()
  async createTicket(
    @Req() req: any,
    @Body()
    body: { subject: string; description: string; organizationId: string },
  ) {
    const data = await this.supportService.createTicket(
      req.account.id,
      body.organizationId,
      body.subject,
      body.description,
    );
    return { status: 'SUCCESS', data };
  }

  @Get(':id')
  async getTicket(@Req() req: any, @Param('id') ticketId: string) {
    const isStaff = req.account.kind === 'STAFF';
    const data = await this.supportService.getTicket(
      ticketId,
      req.account.id,
      isStaff,
    );
    return { status: 'SUCCESS', data };
  }

  @Post(':id/reply')
  async replyToTicket(
    @Req() req: any,
    @Param('id') ticketId: string,
    @Body() body: { message: string },
  ) {
    const isStaff = req.account.kind === 'STAFF';
    const data = await this.supportService.replyToTicket(
      ticketId,
      req.account.id,
      body.message,
      isStaff,
    );
    return { status: 'SUCCESS', data };
  }
}
