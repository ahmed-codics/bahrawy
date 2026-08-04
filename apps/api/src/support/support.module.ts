import { Module, Global } from '@nestjs/common';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';

@Global()
@Module({
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
