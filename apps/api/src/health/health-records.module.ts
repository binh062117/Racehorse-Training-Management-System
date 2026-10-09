import { Module } from '@nestjs/common';
import { FilesModule } from '../files/files.module';
import { HorsesModule } from '../horses/horses.module';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import {
  HealthFilesController,
  HealthRecordsController,
  HorseHealthRecordsController,
} from './health-records.controller';
import { HealthRecordsService } from './health-records.service';
import {
  HealthRecordTreatmentPlansController,
  TreatmentPlanMedicationsController,
} from './treatment-plans.controller';
import { TreatmentPlansService } from './treatment-plans.service';

@Module({
  imports: [FilesModule, HorsesModule],
  controllers: [
    HorseHealthRecordsController,
    HealthRecordsController,
    HealthFilesController,
    HealthRecordTreatmentPlansController,
    TreatmentPlanMedicationsController,
  ],
  providers: [HealthRecordsService, TreatmentPlansService, HorseOwnershipGuard],
})
export class HealthRecordsModule {}
