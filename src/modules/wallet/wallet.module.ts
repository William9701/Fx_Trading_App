import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { WalletService } from './wallet.service';
import { WalletController } from './wallet.controller';
import { WalletRepository } from './repositories/wallet.repository';
import { WalletListener } from './wallet.listener';
import { Wallet } from './entities/wallet.entity';
import { FxRateModule } from '../fx-rate/fx-rate.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Wallet]),
    ConfigModule,
    FxRateModule,
    TransactionModule,
  ],
  controllers: [WalletController],
  providers: [WalletService, WalletRepository, WalletListener],
  exports: [WalletService],
})
export class WalletModule {}
