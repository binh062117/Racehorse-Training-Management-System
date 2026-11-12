import { Type } from 'class-transformer';
import { RaceEntryStatus } from '@prisma/client';
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

export class CreateRaceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name!: string;

  @IsISO8601()
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  venue?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  distance?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  surface?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prizePool?: number;
}

export class UpdateRaceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  venue?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  distance?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  surface?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prizePool?: number | null;
}

export class ListRacesQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  search?: string;

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

export class CreateRaceEntryDto {
  @IsUUID()
  horseId!: string;

  @IsOptional()
  @IsEnum(RaceEntryStatus)
  status?: RaceEntryStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  time?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prizeWon?: number;
}

export class UpdateRaceEntryDto {
  @IsOptional()
  @IsEnum(RaceEntryStatus)
  status?: RaceEntryStatus;

  @IsOptional()
  @IsInt()
  @Min(1)
  position?: number | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  time?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prizeWon?: number | null;
}

export class ListRaceEntriesQueryDto {
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
