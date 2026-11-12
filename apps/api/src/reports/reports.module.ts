import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FilesModule } from '../files/files.module';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import {
  FinanceReportsController,
  HorseReportsController,
  ReportsController,
} from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [PrismaModule, FilesModule],
  controllers: [
    FinanceReportsController,
    HorseReportsController,
    ReportsController,
  ],
  providers: [ReportsService, HorseOwnershipGuard],
  exports: [ReportsService],
})
export class ReportsModule {}
