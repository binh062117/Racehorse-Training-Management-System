import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import {
  HorseSessionsController,
  HorseTrainingPlansController,
  SessionsController,
  TrainingPlansController,
  TrainingOverviewController,
} from './training.controller';
import { TrainingService } from './training.service';
import { MissedSessionsJob } from './missed-sessions.job';

@Module({
  imports: [NotificationsModule],
  controllers: [
    HorseSessionsController,
    SessionsController,
    HorseTrainingPlansController,
    TrainingPlansController,
    TrainingOverviewController,
  ],
  providers: [TrainingService, HorseOwnershipGuard, MissedSessionsJob],
})
export class TrainingModule {}
