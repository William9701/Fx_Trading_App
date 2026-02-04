import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';

@Injectable()
export class TransactionRepository {
  constructor(
    @InjectRepository(Transaction)
    private readonly repository: Repository<Transaction>,
  ) {}

  async create(data: Partial<Transaction>): Promise<Transaction> {
    const transaction = this.repository.create(data);
    return this.repository.save(transaction);
  }

  async findByUserId(
    userId: string,
    options?: { page?: number; limit?: number; type?: string },
  ): Promise<{ data: Transaction[]; total: number }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;

    const where: any = { userId };
    if (options?.type) {
      where.type = options.type;
    }

    const [data, total] = await this.repository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.repository.findOne({ where: { id } });
  }

  // Idempotency check — prevents the same operation from running twice
  async findByIdempotencyKey(key: string): Promise<Transaction | null> {
    return this.repository.findOne({ where: { idempotencyKey: key } });
  }
}
