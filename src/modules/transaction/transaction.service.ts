import { Injectable } from '@nestjs/common';
import { TransactionRepository } from './repositories/transaction.repository';
import { Transaction } from './entities/transaction.entity';

@Injectable()
export class TransactionService {
  constructor(private transactionRepo: TransactionRepository) {}

  async getTransactions(
    userId: string,
    query: { page?: number; limit?: number; type?: string },
  ): Promise<{ data: Transaction[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const result = await this.transactionRepo.findByUserId(userId, {
      page,
      limit,
      type: query.type,
    });

    return {
      ...result,
      page,
      limit,
    };
  }

  async getTransactionById(id: string): Promise<Transaction | null> {
    return this.transactionRepo.findById(id);
  }
}
