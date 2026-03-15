import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { EventsModule } from '../gateway/events.module';
import { ClipboardController } from './clipboard.controller';
import { ClipboardUploadController } from './clipboard-upload.controller';
import { ClipboardShareController, ShareController } from './clipboard-share.controller';
import { ClipboardService } from './clipboard.service';
import { ClipboardUploadService } from './clipboard-upload.service';
import { ClipboardShareService } from './clipboard-share.service';

@Module({
  imports: [StorageModule, EventsModule],
  controllers: [ClipboardController, ClipboardUploadController, ClipboardShareController, ShareController],
  providers: [ClipboardService, ClipboardUploadService, ClipboardShareService],
  exports: [ClipboardService],
})
export class ClipboardModule {}
