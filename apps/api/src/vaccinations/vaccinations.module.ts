import { Module } from '@nestjs/common';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  HorseVaccinationsController,
  VaccinationsController,
} from './vaccinations.controller';
import { VaccinationsService } from './vaccinations.service';

@Module({
  imports: [NotificationsModule],
  controllers: [HorseVaccinationsController, VaccinationsController],
  providers: [VaccinationsService, HorseOwnershipGuard],
  exports: [VaccinationsService],
})
export class VaccinationsModule {}
