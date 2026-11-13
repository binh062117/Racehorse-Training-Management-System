import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { DailyCareJob } from './daily-care.job';
import { DailyCareController } from './daily-care.controller';
import { DailyCareService } from './daily-care.service';

@Module({
  imports: [NotificationsModule],
  controllers: [DailyCareController],
  providers: [DailyCareService, DailyCareJob],
  exports: [DailyCareService],
})
export class DailyCareModule {}
