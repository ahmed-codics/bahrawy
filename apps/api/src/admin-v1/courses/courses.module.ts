import { Module } from '@nestjs/common';
import { AdminV1CoursesController } from './courses.controller';
import { AdminV1CoursesService } from './courses.service';

@Module({
  controllers: [AdminV1CoursesController],
  providers: [AdminV1CoursesService],
})
export class AdminV1CoursesModule {}
