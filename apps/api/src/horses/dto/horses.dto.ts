import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { HealthStatus, HorseGender, HorseStatus } from '@prisma/client';

export class CreateHorseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsUUID()
  ownerId!: string;

  @IsOptional()
  @IsEnum(HorseGender)
  gender?: HorseGender;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  breed?: string;

  @IsOptional()
  @IsISO8601()
  birthDate?: string;

  @IsOptional()
  @IsEnum(HorseStatus)
  status?: HorseStatus;
}

export class UpdateHorseDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsEnum(HorseGender)
  gender?: HorseGender | null;

  // `null` clears the field; a string sets it.
  @IsOptional()
  @IsString()
  @MaxLength(120)
  breed?: string | null;

  @IsOptional()
  @IsISO8601()
  birthDate?: string | null;

  @IsOptional()
  @IsEnum(HorseStatus)
  status?: HorseStatus;

  // Pedigree (Phase 6) — `null` clears the field.
  @IsOptional()
  @IsUUID()
  sireId?: string | null;

  @IsOptional()
  @IsUUID()
  damId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  fitnessScore?: number | null;
}

// Phase 7 — Training Lock. Separate route (PATCH :id/lock, VET-only) from
// UpdateHorseDto (MANAGER) so it's clear which role can touch which field.
export class LockHorseDto {
  @IsBoolean()
  locked!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ListHorsesQueryDto {
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @IsOptional()
  @IsEnum(HorseStatus)
  status?: HorseStatus;

  // Phase 10 (UC-14) — independent of `status` (career lifecycle).
  @IsOptional()
  @IsEnum(HealthStatus)
  healthStatus?: HealthStatus;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

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
