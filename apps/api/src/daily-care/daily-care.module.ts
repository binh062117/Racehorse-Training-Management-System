import { Module } from '@nestjs/common';
import { DailyCareController } from './daily-care.controller';
import { DailyCareService } from './daily-care.service';

@Module({
  controllers: [DailyCareController],
  providers: [DailyCareService],
  exports: [DailyCareService],
})
export class DailyCareModule {}
