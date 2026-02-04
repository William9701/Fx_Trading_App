import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TransactionType, TransactionStatus, Currency } from '@common/enums';
import { User } from '../../auth/entities/user.entity';

@Entity('transactions')
@Index(['userId', 'createdAt'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({
    type: 'enum',
    enum: Currency,
  })
  fromCurrency: Currency;

  @Column({
    type: 'enum',
    enum: Currency,
    nullable: true,
  })
  toCurrency: Currency;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
  })
  amount: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    nullable: true,
  })
  convertedAmount: number;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 8,
    nullable: true,
  })
  exchangeRate: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Idempotency key to prevent duplicate transactions
  @Column({ unique: true, nullable: true })
  idempotencyKey: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
