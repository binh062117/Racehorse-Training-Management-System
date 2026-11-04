import { Module } from '@nestjs/common';
import { StallsController } from './stalls.controller';
import { StallsService } from './stalls.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [StallsController],
  providers: [StallsService],
  exports: [StallsService],
})
export class StallsModule {}
