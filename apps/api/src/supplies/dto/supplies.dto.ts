import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SupplyCategory, SupplyRequestStatus } from '@prisma/client';

export class CreateSupplyItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsEnum(SupplyCategory)
  category!: SupplyCategory;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  minQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateSupplyItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unit?: string;

  /** Stock count after a manual check (kiểm kho). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  minQuantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListSupplyItemsQueryDto {
  @IsOptional()
  @IsEnum(SupplyCategory)
  category?: SupplyCategory;

  /** true → only items at or below their minimum. */
  @IsOptional()
  @IsIn(['true', 'false'])
  low?: 'true' | 'false';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}

export class CreateSupplyRequestDto {
  @IsUUID()
  itemId!: string;

  @IsNumber()
  @Min(0.1)
  @Max(1_000_000)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ReviewSupplyRequestDto {
  @IsIn([SupplyRequestStatus.APPROVED, SupplyRequestStatus.REJECTED])
  status!: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class ListSupplyRequestsQueryDto {
  @IsOptional()
  @IsEnum(SupplyRequestStatus)
  status?: SupplyRequestStatus;

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
