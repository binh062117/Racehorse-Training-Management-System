import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { FilesController } from '../files/files.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import { HorsesController } from './horses.controller';
import { HorsesService } from './horses.service';

@Module({
  imports: [FilesModule, NotificationsModule, AiModule],
  controllers: [HorsesController, FilesController],
  providers: [HorsesService, HorseOwnershipGuard],
  exports: [HorsesService],
})
export class HorsesModule {}
