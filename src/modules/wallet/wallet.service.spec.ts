import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource, QueryRunner, EntityManager } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';
import { WalletRepository } from './repositories/wallet.repository';
import { FxRateService } from '../fx-rate/fx-rate.service';
import { TransactionRepository } from '../transaction/repositories/transaction.repository';
import { TransactionStatus, TransactionType } from '@common/enums';

describe('WalletService', () => {
  let service: WalletService;
  let walletRepo: jest.Mocked<WalletRepository>;
  let fxRateService: jest.Mocked<FxRateService>;
  let transactionRepo: jest.Mocked<TransactionRepository>;
  let dataSource: jest.Mocked<DataSource>;

  const mockEntityManager = {
    save: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<EntityManager>;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: mockEntityManager,
  } as unknown as jest.Mocked<QueryRunner>;

  const mockWallet = {
    id: 'wallet-uuid',
    userId: 'user-uuid',
    currency: 'NGN',
    balance: 100,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        {
          provide: WalletRepository,
          useValue: {
            findByUserIdAndCurrency: jest.fn(),
            findAllByUserId: jest.fn(),
            findForUpdate: jest.fn(),
            create: jest.fn(),
            updateBalance: jest.fn(),
          },
        },
        {
          provide: FxRateService,
          useValue: {
            convertAmount: jest.fn(),
            getRates: jest.fn(),
          },
        },
        {
          provide: TransactionRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              const map = {
                'wallet.initialBalance': 100,
                'wallet.baseCurrency': 'NGN',
              };
              return map[key];
            }),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
    walletRepo = module.get(WalletRepository);
    fxRateService = module.get(FxRateService);
    transactionRepo = module.get(TransactionRepository);
    dataSource = module.get(DataSource);
  });

  describe('getWallets', () => {
    it('should return all wallets for a user', async () => {
      walletRepo.findAllByUserId.mockResolvedValue([mockWallet]);

      const result = await service.getWallets('user-uuid');
      expect(result).toEqual([mockWallet]);
    });
  });

  describe('fundWallet', () => {
    it('should fund an existing wallet', async () => {
      walletRepo.findForUpdate.mockResolvedValue(mockWallet);
      walletRepo.updateBalance.mockResolvedValue();
      transactionRepo.create.mockResolvedValue({} as any);

      const result = await service.fundWallet('user-uuid', {
        amount: 500,
        currency: 'NGN',
      });

      expect(result).toHaveProperty('newBalance', 600);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should create a new wallet if one does not exist', async () => {
      walletRepo.findForUpdate.mockResolvedValue(null);
      (mockEntityManager as any).create.mockReturnValue({ userId: 'user-uuid', currency: 'USD', balance: 0 });
      (mockEntityManager as any).save.mockResolvedValue({ ...mockWallet, currency: 'USD', balance: 0 });
      walletRepo.updateBalance.mockResolvedValue();
      transactionRepo.create.mockResolvedValue({} as any);

      const result = await service.fundWallet('user-uuid', {
        amount: 200,
        currency: 'USD',
      });

      expect((mockEntityManager as any).save).toHaveBeenCalled();
      expect(result).toHaveProperty('newBalance', 200);
    });
  });

  describe('convertCurrency', () => {
    it('should convert currency successfully', async () => {
      walletRepo.findForUpdate
        .mockResolvedValueOnce({ ...mockWallet, balance: 1000 }) // NGN wallet
        .mockResolvedValueOnce({ ...mockWallet, id: 'usd-wallet', currency: 'USD', balance: 10 }); // USD wallet

      fxRateService.convertAmount.mockResolvedValue({
        convertedAmount: 0.65,
        exchangeRate: 0.00065,
      });
      walletRepo.updateBalance.mockResolvedValue();
      transactionRepo.create.mockResolvedValue({} as any);

      const result = await service.convertCurrency('user-uuid', {
        amount: 1000,
        fromCurrency: 'NGN',
        toCurrency: 'USD',
      });

      expect(result).toHaveProperty('amountReceived', 0.65);
      expect(result).toHaveProperty('newSourceBalance', 0);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw if same currency', async () => {
      await expect(
        service.convertCurrency('user-uuid', {
          amount: 100,
          fromCurrency: 'NGN',
          toCurrency: 'NGN',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if insufficient balance', async () => {
      walletRepo.findForUpdate.mockResolvedValue({
        ...mockWallet,
        balance: 50,
      });

      await expect(
        service.convertCurrency('user-uuid', {
          amount: 100,
          fromCurrency: 'NGN',
          toCurrency: 'USD',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('trade', () => {
    it('should execute a trade from NGN to USD', async () => {
      walletRepo.findForUpdate
        .mockResolvedValueOnce({ ...mockWallet, balance: 5000 })
        .mockResolvedValueOnce({ ...mockWallet, id: 'usd-wallet', currency: 'USD', balance: 5 });

      fxRateService.convertAmount.mockResolvedValue({
        convertedAmount: 3.25,
        exchangeRate: 0.00065,
      });
      walletRepo.updateBalance.mockResolvedValue();
      transactionRepo.create.mockResolvedValue({} as any);

      const result = await service.trade('user-uuid', {
        amount: 5000,
        fromCurrency: 'NGN',
        toCurrency: 'USD',
      });

      expect(result).toHaveProperty('amountReceived', 3.25);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw if neither currency is NGN', async () => {
      await expect(
        service.trade('user-uuid', {
          amount: 100,
          fromCurrency: 'USD',
          toCurrency: 'EUR',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if same currency', async () => {
      await expect(
        service.trade('user-uuid', {
          amount: 100,
          fromCurrency: 'NGN',
          toCurrency: 'NGN',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('initializeWallet', () => {
    it('should create NGN wallet with initial balance', async () => {
      walletRepo.create.mockResolvedValue(mockWallet);
      transactionRepo.create.mockResolvedValue({} as any);

      await service.initializeWallet('user-uuid');

      expect(walletRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'NGN', balance: 100 }),
      );
      expect(transactionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: TransactionType.FUNDING,
          status: TransactionStatus.COMPLETED,
          amount: 100,
        }),
      );
    });
  });
});
