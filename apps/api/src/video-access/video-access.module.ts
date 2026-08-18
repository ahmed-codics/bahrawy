import { Module, Global } from '@nestjs/common';
import { StudentVideoAccessRequestService } from './video-access.service';
import { StudentVideoAccessRequestController } from './video-access.controller';
import { VideoAccessService } from './video-access.grants.service';
import { VideoAccessMailerService } from './video-access.mailer';

@Global()
@Module({
  controllers: [StudentVideoAccessRequestController],
  providers: [
    StudentVideoAccessRequestService,
    VideoAccessService,
    VideoAccessMailerService,
  ],
  exports: [VideoAccessService, StudentVideoAccessRequestService, VideoAccessMailerService],
})
export class VideoAccessModule {}
