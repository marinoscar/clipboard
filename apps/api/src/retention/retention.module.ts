import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { RetentionService } from './retention.service';

// StorageModule is @Global() so S3StorageProvider is injected automatically.

@Module({
  imports: [PrismaModule, SettingsModule],
  providers: [RetentionService],
})
export class RetentionModule {}
