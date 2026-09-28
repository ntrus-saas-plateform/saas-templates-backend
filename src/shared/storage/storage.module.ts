import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../configuration/configuration.module.js';
import type { EnvironmentConfig } from '../configuration/environment.schema.js';
import { LocalFileStorage } from './local-file.storage.js';
import { S3FileStorage } from './s3-file.storage.js';
import { FILE_STORAGE_PORT } from '../../core/domain/ports/file-storage.port.js';
import { FilesController } from './files.controller.js';

@Global()
@Module({
  controllers: [FilesController],
  providers: [
    LocalFileStorage,
    S3FileStorage,
    {
      provide: FILE_STORAGE_PORT,
      useFactory: (config: EnvironmentConfig, local: LocalFileStorage, s3: S3FileStorage) => {
        if (config.STORAGE_PROVIDER === 's3') return s3;
        return local;
      },
      inject: [APP_CONFIG, LocalFileStorage, S3FileStorage],
    },
  ],
  exports: [FILE_STORAGE_PORT],
})
export class StorageModule {}
