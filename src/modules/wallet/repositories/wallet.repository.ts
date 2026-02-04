import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';

@Injectable()
export class WalletRepository {
  constructor(
    @InjectRepository(Wallet)
    private readonly repository: Repository<Wallet>,
  ) {}

  async findByUserIdAndCurrency(
    userId: string,
    currency: string,
  ): Promise<Wallet | null> {
    return this.repository.findOne({
      where: { userId, currency: currency.toUpperCase() as any },
    });
  }

  async findAllByUserId(userId: string): Promise<Wallet[]> {
    return this.repository.find({ where: { userId } });
  }

  async create(data: Partial<Wallet>): Promise<Wallet> {
    const wallet = this.repository.create(data);
    return this.repository.save(wallet);
  }

  // Runs inside an existing transaction manager so callers can wrap
  // multiple wallet operations in a single atomic block
  async updateBalance(
    entityManager: EntityManager,
    walletId: string,
    newBalance: number,
  ): Promise<void> {
    await entityManager
      .createQueryBuilder()
      .update(Wallet)
      .set({ balance: newBalance })
      .where('id = :id', { id: walletId })
      .execute();
  }

  // Locks the row for update so no other transaction can read stale balance
  async findForUpdate(
    entityManager: EntityManager,
    userId: string,
    currency: string,
  ): Promise<Wallet | null> {
    return entityManager
      .createQueryBuilder(Wallet, 'wallet')
      .where('wallet.userId = :userId AND wallet.currency = :currency', {
        userId,
        currency: currency.toUpperCase(),
      })
      .setLock('pessimistic_write')
      .getOne();
  }
}
