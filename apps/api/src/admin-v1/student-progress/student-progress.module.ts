import { Module } from '@nestjs/common';
import { AdminV1StudentProgressController } from './student-progress.controller';
import { AdminV1StudentProgressService } from './student-progress.service';

@Module({
  controllers: [AdminV1StudentProgressController],
  providers: [AdminV1StudentProgressService],
})
export class AdminV1StudentProgressModule {}
