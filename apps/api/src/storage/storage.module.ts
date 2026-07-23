import { Module, Global } from '@nestjs/common';
import { StorageService, ClamAvService } from './storage.service';
import { StorageController } from './storage.controller';

@Global()
@Module({
  controllers: [StorageController],
  providers: [StorageService, ClamAvService],
  exports: [StorageService, ClamAvService],
})
export class StorageModule {}
