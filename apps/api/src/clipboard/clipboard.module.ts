import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { EventsModule } from '../gateway/events.module';
import { ClipboardController } from './clipboard.controller';
import { ClipboardUploadController } from './clipboard-upload.controller';
import { ClipboardService } from './clipboard.service';
import { ClipboardUploadService } from './clipboard-upload.service';

@Module({
  imports: [StorageModule, EventsModule],
  controllers: [ClipboardController, ClipboardUploadController],
  providers: [ClipboardService, ClipboardUploadService],
  exports: [ClipboardService],
})
export class ClipboardModule {}
