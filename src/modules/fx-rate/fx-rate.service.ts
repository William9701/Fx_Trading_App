import { Injectable, Inject, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { AxiosError } from 'axios';

const FX_CACHE_KEY = 'fx_rates';

// Shape of what exchangerate-api free tier v4 actually returns
interface ExchangeRateApiResponse {
  base: string;
  rates: Record<string, number>;
  time_last_updated: number;
}

@Injectable()
export class FxRateService {
  private readonly logger = new Logger(FxRateService.name);

  // Fallback rates used when the external API is unreachable
  private readonly fallbackRates: Record<string, number> = {
    NGN: 1,
    USD: 0.00065,
    EUR: 0.0006,
    GBP: 0.00051,
    JPY: 0.1,
    CAD: 0.00087,
    AUD: 0.00098,
    CHF: 0.00057,
    CNY: 0.0047,
  };

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  // Returns rates keyed to NGN as the base currency
  async getRates(): Promise<Record<string, number>> {
    // Try cache first — if Redis is down, skip gracefully
    let cached: Record<string, number> | undefined;
    try {
      cached = await this.cacheManager.get<Record<string, number>>(FX_CACHE_KEY);
    } catch (e) {
      this.logger.warn('Cache read failed, fetching fresh rates');
    }

    if (cached) {
      return cached;
    }

    // Cache miss — fetch fresh rates
    try {
      const rates = await this.fetchRatesFromApi();
      const ttl = this.configService.get<number>('fxRate.cacheTtl');

      try { await this.cacheManager.set(FX_CACHE_KEY, rates, ttl); } catch (e) { this.logger.warn('Cache write failed, rates not cached'); }

      return rates;
    } catch (error) {
      this.logger.warn(
        `FX API unavailable, using fallback rates: ${error.message}`,
      );
      return this.fallbackRates;
    }
  }

  // Get the rate for a single target currency (relative to NGN)
  async getRate(currency: string): Promise<number> {
    const rates = await this.getRates();
    const rate = rates[currency.toUpperCase()];

    if (!rate) {
      throw new ServiceUnavailableException(
        `Rate not available for currency: ${currency}`,
      );
    }

    return rate;
  }

  // Convert an amount between two currencies using live rates
  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<{ convertedAmount: number; exchangeRate: number }> {
    if (fromCurrency === toCurrency) {
      return { convertedAmount: amount, exchangeRate: 1 };
    }

    const rates = await this.getRates();
    const fromRate = rates[fromCurrency.toUpperCase()];
    const toRate = rates[toCurrency.toUpperCase()];

    if (!fromRate || !toRate) {
      throw new ServiceUnavailableException(
        'One or both currency rates are unavailable',
      );
    }

    // NGN is base (rate = 1), so: amount_in_NGN = amount / fromRate,
    // then amount_in_target = amount_in_NGN * toRate
    const amountInNgn = amount / fromRate;
    const convertedAmount = amountInNgn * toRate;

    // The actual pair rate from source → target
    const exchangeRate = toRate / fromRate;

    return {
      convertedAmount: parseFloat(convertedAmount.toFixed(2)),
      exchangeRate: parseFloat(exchangeRate.toFixed(8)),
    };
  }

  // Returns all supported currencies that we currently have rates for
  async getSupportedCurrencies(): Promise<string[]> {
    const rates = await this.getRates();
    return Object.keys(rates);
  }

  private async fetchRatesFromApi(): Promise<Record<string, number>> {
    const apiUrl = this.configService.get<string>('fxRate.apiUrl');

    // exchangerate-api free tier uses NGN as base directly
    const response = await firstValueFrom(
      this.httpService
        .get<ExchangeRateApiResponse>(`${apiUrl}/NGN`)
        .pipe(
          map((res) => res.data),
          catchError((error: AxiosError) => {
            this.logger.error(
              `FX API request failed: ${error.response?.status || error.message}`,
            );
            throw new Error('Failed to fetch exchange rates');
          }),
        ),
    );

    return response.rates;
  }
}
