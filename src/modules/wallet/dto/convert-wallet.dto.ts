import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString } from 'class-validator';
import { IsValidCurrency } from './custom-currency.validator';

export class ConvertWalletDto {
  @ApiProperty({
    description: 'Amount to convert',
    example: 1000,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @IsPositive({ message: 'Amount must be a positive number' })
  amount: number;

  @ApiProperty({
    description: 'Currency to convert from',
    example: 'NGN',
  })
  @IsString({ message: 'fromCurrency must be a string' })
  @IsValidCurrency({ message: 'Unsupported source currency' })
  fromCurrency: string;

  @ApiProperty({
    description: 'Currency to convert to',
    example: 'USD',
  })
  @IsString({ message: 'toCurrency must be a string' })
  @IsValidCurrency({ message: 'Unsupported target currency' })
  toCurrency: string;
}
