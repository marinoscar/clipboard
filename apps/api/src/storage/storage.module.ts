import { Global, Module } from '@nestjs/common';
import { S3StorageProvider } from './s3-storage.provider';

@Global()
@Module({
  providers: [S3StorageProvider],
  exports: [S3StorageProvider],
})
export class StorageModule {}
