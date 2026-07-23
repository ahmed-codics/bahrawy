import { Module, Global } from '@nestjs/common';
import { StaffAccessService } from './staff-access.service';

@Global()
@Module({
  providers: [StaffAccessService],
  exports: [StaffAccessService],
})
export class StaffAccessModule {}
