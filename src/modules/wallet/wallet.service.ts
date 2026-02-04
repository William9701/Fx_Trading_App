import {
  Injectable,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { WalletRepository } from './repositories/wallet.repository';
import { FxRateService } from '../fx-rate/fx-rate.service';
import { TransactionRepository } from '../transaction/repositories/transaction.repository';
import { FundWalletDto, ConvertWalletDto, TradeWalletDto } from './dto';
import { TransactionType, TransactionStatus, Currency } from '@common/enums';
import { Wallet } from './entities/wallet.entity';

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private walletRepo: WalletRepository,
    private fxRateService: FxRateService,
    private transactionRepo: TransactionRepository,
    private configService: ConfigService,
    private dataSource: DataSource,
  ) {}

  // Returns all wallet balances for the current user
  async getWallets(userId: string): Promise<Wallet[]> {
    return this.walletRepo.findAllByUserId(userId);
  }

  // Tops up a specific currency wallet; creates it if it doesn't exist yet
  async fundWallet(userId: string, dto: FundWalletDto): Promise<object> {
    const currency = (dto.currency || 'NGN').toUpperCase();
    const idempotencyKey = uuidv4();

    const queryRunner = await this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let wallet = await this.walletRepo.findForUpdate(
        queryRunner.manager,
        userId,
        currency,
      );

      // First time funding this currency — bootstrap the wallet row
      if (!wallet) {
        wallet = await queryRunner.manager.save(
          Wallet,
          queryRunner.manager.create(Wallet, {
            userId,
            currency: currency as Currency,
            balance: 0,
          }),
        );
      }

      const newBalance = Number(wallet.balance) + dto.amount;

      await this.walletRepo.updateBalance(
        queryRunner.manager,
        wallet.id,
        newBalance,
      );

      // Record it
      await this.transactionRepo.create({
        userId,
        type: TransactionType.FUNDING,
        status: TransactionStatus.COMPLETED,
        fromCurrency: currency as Currency,
        toCurrency: currency as Currency,
        amount: dto.amount,
        convertedAmount: dto.amount,
        exchangeRate: 1,
        description: `Funded ${currency} wallet`,
        idempotencyKey,
      });

      await queryRunner.commitTransaction();

      return {
        message: `Successfully funded ${currency} wallet`,
        currency,
        amount: dto.amount,
        newBalance: newBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Fund wallet failed: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // Currency conversion — updates both wallets inside one transaction
  async convertCurrency(userId: string, dto: ConvertWalletDto): Promise<object> {
    const fromCurrency = dto.fromCurrency.toUpperCase();
    const toCurrency = dto.toCurrency.toUpperCase();

    if (fromCurrency === toCurrency) {
      throw new BadRequestException('Source and target currencies must be different');
    }

    const idempotencyKey = uuidv4();
    const queryRunner = await this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Grab the source wallet with a row lock inside the transaction
      const sourceWallet = await this.walletRepo.findForUpdate(
        queryRunner.manager,
        userId,
        fromCurrency,
      );

      if (!sourceWallet || Number(sourceWallet.balance) < dto.amount) {
        throw new BadRequestException(
          `Insufficient ${fromCurrency} balance. Available: ${sourceWallet?.balance || 0}`,
        );
      }

      // Get conversion result from the FX service
      const { convertedAmount, exchangeRate } =
        await this.fxRateService.convertAmount(dto.amount, fromCurrency, toCurrency);

      // Debit source
      const newSourceBalance = Number(sourceWallet.balance) - dto.amount;
      await this.walletRepo.updateBalance(
        queryRunner.manager,
        sourceWallet.id,
        newSourceBalance,
      );

      // Credit target — lock it too; create if first time
      let targetWallet = await this.walletRepo.findForUpdate(
        queryRunner.manager,
        userId,
        toCurrency,
      );

      if (!targetWallet) {
        targetWallet = await queryRunner.manager.save(
          Wallet,
          queryRunner.manager.create(Wallet, {
            userId,
            currency: toCurrency as Currency,
            balance: 0,
          }),
        );
      }

      const newTargetBalance = Number(targetWallet.balance) + convertedAmount;
      await this.walletRepo.updateBalance(
        queryRunner.manager,
        targetWallet.id,
        newTargetBalance,
      );

      // Persist the transaction record
      await this.transactionRepo.create({
        userId,
        type: TransactionType.CONVERSION,
        status: TransactionStatus.COMPLETED,
        fromCurrency: fromCurrency as Currency,
        toCurrency: toCurrency as Currency,
        amount: dto.amount,
        convertedAmount,
        exchangeRate,
        description: `Converted ${dto.amount} ${fromCurrency} to ${convertedAmount} ${toCurrency}`,
        idempotencyKey,
      });

      await queryRunner.commitTransaction();

      return {
        message: 'Conversion successful',
        fromCurrency,
        toCurrency,
        amountConverted: dto.amount,
        amountReceived: convertedAmount,
        exchangeRate,
        newSourceBalance,
        newTargetBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof BadRequestException) throw error;

      this.logger.error(`Currency conversion failed: ${error.message}`);
      throw new BadRequestException('Conversion failed. Please try again.');
    } finally {
      await queryRunner.release();
    }
  }

  // Essentially the same flow as convert, but logged as a "trade" for analytics
  async trade(userId: string, dto: TradeWalletDto): Promise<object> {
    const fromCurrency = dto.fromCurrency.toUpperCase();
    const toCurrency = dto.toCurrency.toUpperCase();

    if (fromCurrency === toCurrency) {
      throw new BadRequestException('Source and target currencies must be different');
    }

    // At least one side must involve NGN per the spec
    if (fromCurrency !== 'NGN' && toCurrency !== 'NGN') {
      throw new BadRequestException(
        'Trading is only supported between NGN and another currency',
      );
    }

    const idempotencyKey = uuidv4();
    const queryRunner = await this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const sourceWallet = await this.walletRepo.findForUpdate(
        queryRunner.manager,
        userId,
        fromCurrency,
      );

      if (!sourceWallet || Number(sourceWallet.balance) < dto.amount) {
        throw new BadRequestException(
          `Insufficient ${fromCurrency} balance. Available: ${sourceWallet?.balance || 0}`,
        );
      }

      const { convertedAmount, exchangeRate } =
        await this.fxRateService.convertAmount(dto.amount, fromCurrency, toCurrency);

      // Debit
      const newSourceBalance = Number(sourceWallet.balance) - dto.amount;
      await this.walletRepo.updateBalance(
        queryRunner.manager,
        sourceWallet.id,
        newSourceBalance,
      );

      // Credit — lock target, create if needed
      let targetWallet = await this.walletRepo.findForUpdate(
        queryRunner.manager,
        userId,
        toCurrency,
      );

      if (!targetWallet) {
        targetWallet = await queryRunner.manager.save(
          Wallet,
          queryRunner.manager.create(Wallet, {
            userId,
            currency: toCurrency as Currency,
            balance: 0,
          }),
        );
      }

      const newTargetBalance = Number(targetWallet.balance) + convertedAmount;
      await this.walletRepo.updateBalance(
        queryRunner.manager,
        targetWallet.id,
        newTargetBalance,
      );

      await this.transactionRepo.create({
        userId,
        type: TransactionType.TRADE,
        status: TransactionStatus.COMPLETED,
        fromCurrency: fromCurrency as Currency,
        toCurrency: toCurrency as Currency,
        amount: dto.amount,
        convertedAmount,
        exchangeRate,
        description: `Traded ${dto.amount} ${fromCurrency} for ${convertedAmount} ${toCurrency}`,
        idempotencyKey,
      });

      await queryRunner.commitTransaction();

      return {
        message: 'Trade executed successfully',
        fromCurrency,
        toCurrency,
        amountTraded: dto.amount,
        amountReceived: convertedAmount,
        exchangeRate,
        newSourceBalance,
        newTargetBalance,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();

      if (error instanceof BadRequestException) throw error;

      this.logger.error(`Trade failed: ${error.message}`);
      throw new BadRequestException('Trade failed. Please try again.');
    } finally {
      await queryRunner.release();
    }
  }

  // Called once during registration to seed the default NGN wallet
  async initializeWallet(userId: string): Promise<void> {
    const initialBalance = this.configService.get<number>(
      'wallet.initialBalance',
    );

    await this.walletRepo.create({
      userId,
      currency: Currency.NGN,
      balance: initialBalance,
    });

    // Log the initial credit as a funding transaction
    await this.transactionRepo.create({
      userId,
      type: TransactionType.FUNDING,
      status: TransactionStatus.COMPLETED,
      fromCurrency: Currency.NGN,
      toCurrency: Currency.NGN,
      amount: initialBalance,
      convertedAmount: initialBalance,
      exchangeRate: 1,
      description: 'Initial wallet credit on account verification',
    });
  }
}
