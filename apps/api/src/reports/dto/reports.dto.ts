import {
  IsISO8601,
  IsOptional,
  IsUUID,
  IsIn,
  IsNumber,
  Min,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class FinanceReportQueryDto {
  @IsOptional()
  @IsUUID()
  horseId?: string;

  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class CreateExpenseDto {
  @IsUUID()
  horseId!: string;

  @IsISO8601()
  date!: string;

  @IsIn([
    'FEEDING',
    'FARRIER',
    'VACCINATION',
    'DEWORMING',
    'MEDICAL',
    'BOARDING',
  ])
  category!: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(2000)
  description!: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}
