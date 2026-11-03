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
  @IsOptional()
  @IsUUID()
  groomId?: string | null;

  @IsISO8601()
  scheduledAt!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10000)
  distanceM?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  surface?: string;

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
  @IsUUID()
  groomId?: string | null;

  @IsOptional()
  @IsUUID()
  planId?: string | null;

  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10000)
  distanceM?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  surface?: string;

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

  /** Time to finish the session's distance, in seconds. */
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(1)
  @Max(36000)
  finishTimeSec?: number;

  /** Heart rate after the recovery period, in bpm. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(20)
  @Max(250)
  recoveryHeartRate?: number;

  /** NORMAL | TIGHT | SORE */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  muscleResponse?: string;
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
  @Max(500)
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

  /** Target distance (m) the horse should reach in this plan, e.g. 1600. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10000)
  targetDistanceM?: number;
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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(10000)
  targetDistanceM?: number | null;
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
