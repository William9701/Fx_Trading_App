import { Test, TestingModule } from '@nestjs/testing';
import { TransactionService } from './transaction.service';
import { TransactionRepository } from './repositories/transaction.repository';

describe('TransactionService', () => {
  let service: TransactionService;
  let transactionRepo: jest.Mocked<TransactionRepository>;

  const mockTransaction = {
    id: 'tx-uuid',
    userId: 'user-uuid',
    type: 'funding',
    status: 'completed',
    fromCurrency: 'NGN',
    toCurrency: 'NGN',
    amount: 100,
    createdAt: new Date(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: TransactionRepository,
          useValue: {
            findByUserId: jest.fn(),
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionService>(TransactionService);
    transactionRepo = module.get(TransactionRepository);
  });

  describe('getTransactions', () => {
    it('should return paginated transactions', async () => {
      transactionRepo.findByUserId.mockResolvedValue({
        data: [mockTransaction],
        total: 1,
      });

      const result = await service.getTransactions('user-uuid', {
        page: 1,
        limit: 20,
      });

      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should filter by transaction type', async () => {
      transactionRepo.findByUserId.mockResolvedValue({
        data: [mockTransaction],
        total: 1,
      });

      await service.getTransactions('user-uuid', {
        type: 'funding',
      });

      expect(transactionRepo.findByUserId).toHaveBeenCalledWith(
        'user-uuid',
        expect.objectContaining({ type: 'funding' }),
      );
    });
  });

  describe('getTransactionById', () => {
    it('should return a transaction by ID', async () => {
      transactionRepo.findById.mockResolvedValue(mockTransaction);

      const result = await service.getTransactionById('tx-uuid');
      expect(result).toEqual(mockTransaction);
    });

    it('should return null if transaction not found', async () => {
      transactionRepo.findById.mockResolvedValue(null);

      const result = await service.getTransactionById('nonexistent');
      expect(result).toBeNull();
    });
  });
});
