import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import {
  HorseReportsController,
  ReportsController,
} from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [FilesModule],
  controllers: [HorseReportsController, ReportsController],
  providers: [ReportsService, HorseOwnershipGuard],
})
export class ReportsModule {}
