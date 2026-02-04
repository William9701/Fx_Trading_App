import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ServiceUnavailableException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { FxRateService } from './fx-rate.service';

describe('FxRateService', () => {
  let service: FxRateService;
  let cacheManager: any;
  let httpService: jest.Mocked<HttpService>;

  const mockRates = {
    NGN: 1,
    USD: 0.00065,
    EUR: 0.0006,
    GBP: 0.00051,
  };

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FxRateService,
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              const map = {
                'fxRate.apiUrl': 'https://api.exchangerate-api.com/v4/latest',
                'fxRate.cacheTtl': 300,
              };
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FxRateService>(FxRateService);
    httpService = module.get(HttpService);
  });

  describe('getRates', () => {
    it('should return cached rates if available', async () => {
      cacheManager.get.mockResolvedValue(mockRates);

      const result = await service.getRates();
      expect(result).toEqual(mockRates);
      expect(httpService.get).not.toHaveBeenCalled();
    });

    it('should fetch from API on cache miss and cache the result', async () => {
      cacheManager.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(
        of({
          data: {
            base_code: 'NGN',
            conversion_rates: mockRates,
          },
        }) as any,
      );

      const result = await service.getRates();
      expect(result).toEqual(mockRates);
      expect(cacheManager.set).toHaveBeenCalledWith('fx_rates', mockRates, 300);
    });

    it('should fall back to hardcoded rates when API fails', async () => {
      cacheManager.get.mockResolvedValue(null);
      httpService.get.mockReturnValue(
        throwError(() => new Error('Network error')) as any,
      );

      const result = await service.getRates();
      // Should return fallback rates without throwing
      expect(result).toHaveProperty('NGN');
      expect(result).toHaveProperty('USD');
    });
  });

  describe('getRate', () => {
    it('should return the rate for a valid currency', async () => {
      cacheManager.get.mockResolvedValue(mockRates);

      const rate = await service.getRate('USD');
      expect(rate).toBe(0.00065);
    });

    it('should throw for unsupported currency', async () => {
      cacheManager.get.mockResolvedValue(mockRates);

      await expect(service.getRate('XYZ')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('convertAmount', () => {
    it('should return 1:1 when same currency', async () => {
      const result = await service.convertAmount(100, 'NGN', 'NGN');
      expect(result).toEqual({ convertedAmount: 100, exchangeRate: 1 });
    });

    it('should correctly convert NGN to USD', async () => {
      cacheManager.get.mockResolvedValue(mockRates);

      const result = await service.convertAmount(1000, 'NGN', 'USD');

      // 1000 NGN / 1 (NGN rate) * 0.00065 (USD rate) = 0.65
      expect(result.convertedAmount).toBe(0.65);
      expect(result.exchangeRate).toBe(0.00065);
    });

    it('should correctly convert USD to NGN', async () => {
      cacheManager.get.mockResolvedValue(mockRates);

      const result = await service.convertAmount(1, 'USD', 'NGN');

      // 1 USD / 0.00065 * 1 = ~1538.46
      expect(result.convertedAmount).toBe(1538.46);
    });
  });
});
