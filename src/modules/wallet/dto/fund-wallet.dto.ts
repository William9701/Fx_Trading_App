import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsOptional, IsString } from 'class-validator';
import { IsValidCurrency } from './custom-currency.validator';

export class FundWalletDto {
  @ApiProperty({
    description: 'Amount to fund',
    example: 5000,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @IsPositive({ message: 'Amount must be a positive number' })
  amount: number;

  @ApiProperty({
    description: 'Currency to fund (defaults to NGN)',
    example: 'NGN',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Currency must be a string' })
  @IsValidCurrency({ message: 'Unsupported currency' })
  currency?: string;
}
