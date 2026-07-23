import { Module } from '@nestjs/common';
import { AdminV1AcademicController } from './academic.controller';
import { AdminV1AcademicService } from './academic.service';

@Module({
  controllers: [AdminV1AcademicController],
  providers: [AdminV1AcademicService],
})
export class AdminV1AcademicModule {}
