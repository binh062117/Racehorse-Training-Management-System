import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { HealthStatus } from '@prisma/client';

export class CreateHealthRecordDto {
  @IsISO8601()
  examDate!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  diagnosis!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  treatment?: string;

  // Phase 10 (UC-15) — when sent, also writes Horse.healthStatus.
  @IsOptional()
  @IsEnum(HealthStatus)
  healthStatus?: HealthStatus;
}

export class UpdateHealthRecordDto {
  @IsOptional()
  @IsISO8601()
  examDate?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  diagnosis?: string;

  // `null` clears the treatment; a string sets it.
  @IsOptional()
  @ValidateIf((_o, v) => v !== null)
  @IsString()
  @MaxLength(2000)
  treatment?: string | null;
}

export class ListHealthRecordsQueryDto {
  @IsOptional()
  @IsEnum(HealthStatus)
  healthStatus?: HealthStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

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
