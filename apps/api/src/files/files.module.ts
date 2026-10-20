import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileStorageService } from './file-storage.service';
import { CloudinaryService } from './cloudinary.service';
import { buildMulterOptions } from './upload';

@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => buildMulterOptions(config),
    }),
  ],
  providers: [FileStorageService, CloudinaryService],
  exports: [FileStorageService, CloudinaryService, MulterModule],
})
export class FilesModule {}
