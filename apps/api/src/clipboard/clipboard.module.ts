import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { ClipboardController } from './clipboard.controller';
import { ClipboardService } from './clipboard.service';

@Module({
  imports: [StorageModule],
  controllers: [ClipboardController],
  providers: [ClipboardService],
  exports: [ClipboardService],
})
export class ClipboardModule {}
