import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive, IsString } from 'class-validator';
import { IsValidCurrency } from './custom-currency.validator';

export class TradeWalletDto {
  @ApiProperty({
    description: 'Amount to trade',
    example: 500,
  })
  @IsNumber({}, { message: 'Amount must be a number' })
  @IsPositive({ message: 'Amount must be a positive number' })
  amount: number;

  @ApiProperty({
    description: 'Currency you are selling',
    example: 'NGN',
  })
  @IsString({ message: 'fromCurrency must be a string' })
  @IsValidCurrency({ message: 'Unsupported source currency' })
  fromCurrency: string;

  @ApiProperty({
    description: 'Currency you want to buy',
    example: 'USD',
  })
  @IsString({ message: 'toCurrency must be a string' })
  @IsValidCurrency({ message: 'Unsupported target currency' })
  toCurrency: string;
}
