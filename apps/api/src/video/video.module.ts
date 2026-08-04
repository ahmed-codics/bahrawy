import { Module, Global } from '@nestjs/common';
import { VideoService } from './video.service';
import { VideoController } from './video.controller';
import { AdminVideoController } from './admin-video.controller';

@Global()
@Module({
  controllers: [VideoController, AdminVideoController],
  providers: [VideoService],
  exports: [VideoService],
})
export class VideoModule {}
