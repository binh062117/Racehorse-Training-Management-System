import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  SuppliesController,
  SupplyRequestsController,
} from './supplies.controller';
import { SuppliesService } from './supplies.service';

@Module({
  imports: [NotificationsModule],
  controllers: [SuppliesController, SupplyRequestsController],
  providers: [SuppliesService],
  exports: [SuppliesService],
})
export class SuppliesModule {}
