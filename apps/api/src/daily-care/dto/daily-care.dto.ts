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
import { DailyCareTask } from '@prisma/client';

export class CreateDailyCareDto {
  @IsUUID()
  horseId!: string;

  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsEnum(DailyCareTask)
  taskType!: DailyCareTask;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class GenerateDailyChecklistDto {
  @IsOptional()
  @IsUUID()
  horseId?: string;

  @IsOptional()
  @IsISO8601()
  date?: string;
}

export class UpdateDailyCareDto {
  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListDailyCareQueryDto {
  @IsOptional()
  @IsUUID()
  horseId?: string;

  @IsOptional()
  @IsUUID()
  groomId?: string;

  @IsOptional()
  @IsISO8601()
  date?: string;

  @IsOptional()
  @IsEnum(DailyCareTask)
  taskType?: DailyCareTask;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  completed?: boolean;

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
  limit = 50;
}
