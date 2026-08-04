import { Module, Global } from '@nestjs/common';
import { TotpService } from './totp.service';

@Global()
@Module({
  providers: [TotpService],
  exports: [TotpService],
})
export class TotpModule {}
