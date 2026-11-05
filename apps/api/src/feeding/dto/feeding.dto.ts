import { Type } from 'class-transformer';
import {
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

export class CreateFeedingRecordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  feedType!: string;

  @IsNumber()
  @Min(0.1)
  @Max(100)
  quantityKg!: number;

  @IsISO8601()
  date!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** Feed taken from the supply store — its stock goes down by quantityKg. */
  @IsOptional()
  @IsUUID()
  supplyItemId?: string;
}

export class ListFeedingRecordsQueryDto {
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
