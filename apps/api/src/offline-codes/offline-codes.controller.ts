import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { OfflineCodesService } from './offline-codes.service';
import { ActivateOfflineCodeDto } from '../admin-v1/offline-codes/offline-codes.dto';

@Controller('student/offline-codes')
export class OfflineCodesController {
  constructor(private readonly offlineCodesService: OfflineCodesService) {}

  @Post('activate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SessionAuthGuard)
  async activate(@Req() req: any, @Body() body: ActivateOfflineCodeDto) {
    const account = req.account;
    const result = await this.offlineCodesService.activateCode(
      account.id,
      account.organizationId,
      { code: body.code },
    );
    return { status: 'SUCCESS', data: result };
  }
}
