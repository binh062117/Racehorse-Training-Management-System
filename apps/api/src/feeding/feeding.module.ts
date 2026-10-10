import { Module } from '@nestjs/common';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import { HorseFeedingRecordsController } from './feeding.controller';
import { FeedingService } from './feeding.service';

@Module({
  controllers: [HorseFeedingRecordsController],
  providers: [FeedingService, HorseOwnershipGuard],
  exports: [FeedingService],
})
export class FeedingModule {}
