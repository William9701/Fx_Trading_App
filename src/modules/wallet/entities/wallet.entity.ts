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
import { Currency } from '@common/enums';
import { User } from '../../auth/entities/user.entity';

@Entity('wallets')
@Index(['userId', 'currency'], { unique: true })
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, (user) => user.wallets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: Currency,
  })
  currency: Currency;

  @Column({
    type: 'decimal',
    precision: 18,
    scale: 2,
    default: 0,
  })
  balance: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
