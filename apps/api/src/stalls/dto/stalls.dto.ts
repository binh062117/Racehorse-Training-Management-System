import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { StallStatus } from '@prisma/client';

export class CreateStallDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  barn!: string;

  @IsOptional()
  @IsEnum(StallStatus)
  status?: StallStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateStallDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  barn?: string;

  @IsOptional()
  @IsEnum(StallStatus)
  status?: StallStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class RequestStallStatusDto {
  @IsEnum(StallStatus)
  targetStatus!: StallStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ApproveStallStatusDto {
  @IsNotEmpty()
  approved!: boolean; // true = đồng ý chuyển sang pendingStatus, false = từ chối (hủy pending)

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
