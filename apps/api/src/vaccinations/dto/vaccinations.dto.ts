import { Transform, Type } from 'class-transformer';
import { PreventiveCareType } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  IsUUID,
} from 'class-validator';

export class CreateVaccinationDto {
  @IsOptional()
  @IsEnum(PreventiveCareType)
  careType?: PreventiveCareType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  vaccineName!: string;

  @IsISO8601()
  date!: string;

  @IsOptional()
  @IsISO8601()
  nextDueDate?: string;
}

export class ListVaccinationsQueryDto {
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

export class ListUpcomingVaccinationsQueryDto extends ListVaccinationsQueryDto {
  /** Only this horse — pages opened from a horse's record keep it selected. */
  @IsOptional()
  @IsUUID()
  horseId?: string;

  // Query strings are always strings — see notifications.dto.ts for why a
  // plain @Type(() => Boolean) is unsafe for "false".
  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === 'true',
  )
  @IsBoolean()
  upcoming?: boolean;

  @IsOptional()
  @IsEnum(PreventiveCareType)
  careType?: PreventiveCareType;
}
