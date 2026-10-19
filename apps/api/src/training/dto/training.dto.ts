import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SessionStatus } from '@prisma/client';

export class CreateSessionDto {
  @IsISO8601()
  scheduledAt!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  // Phase 7 — optional link to a TrainingPlan; must belong to the same horse.
  @IsOptional()
  @IsUUID()
  planId?: string;
}

export class UpdateSessionDto {
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  resultMetric?: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  resultValue?: number;
}

export class ListSessionsQueryDto {
  @IsOptional()
  @IsEnum(SessionStatus)
  status?: SessionStatus;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

// Phase 7 — Training plans.
export class CreateTrainingPlanDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  goal!: string;

  @IsISO8601()
  startDate!: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;
}

export class UpdateTrainingPlanDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  goal?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string | null;
}

export class ListTrainingPlansQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
