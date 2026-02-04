import {
  Controller,
  Get,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FxRateService } from './fx-rate.service';
import { JwtAuthGuard, VerifiedGuard } from '@common/guards';

@ApiTags('FX Rates')
@Controller('fx')
export class FxRateController {
  constructor(private fxRateService: FxRateService) {}

  @Get('rates')
  @UseGuards(JwtAuthGuard, VerifiedGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current FX rates for all supported currencies' })
  @ApiResponse({ status: 200, description: 'Returns all currency rates keyed to NGN' })
  async getRates() {
    const rates = await this.fxRateService.getRates();
    return {
      baseCurrency: 'NGN',
      rates,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('rates/:currency')
  @UseGuards(JwtAuthGuard, VerifiedGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the FX rate for a specific currency pair against NGN' })
  @ApiParam({ name: 'currency', example: 'USD', description: 'Target currency code' })
  @ApiResponse({ status: 200, description: 'Rate for the requested currency' })
  async getRateByCurrency(@Param('currency') currency: string) {
    const rate = await this.fxRateService.getRate(currency);
    return {
      baseCurrency: 'NGN',
      targetCurrency: currency.toUpperCase(),
      rate,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('supported')
  @UseGuards(JwtAuthGuard, VerifiedGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all supported currency codes' })
  @ApiResponse({ status: 200, description: 'Array of supported currency codes' })
  async getSupportedCurrencies() {
    const currencies = await this.fxRateService.getSupportedCurrencies();
    return { currencies };
  }
}
