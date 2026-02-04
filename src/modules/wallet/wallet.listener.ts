import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WalletService } from './wallet.service';

// Listens for auth events so wallet module doesn't need to import auth directly
@Injectable()
export class WalletListener {
  private readonly logger = new Logger(WalletListener.name);

  constructor(private walletService: WalletService) {}

  @OnEvent('user.verified')
  async handleUserVerified(payload: { userId: string }): Promise<void> {
    try {
      await this.walletService.initializeWallet(payload.userId);
      this.logger.log(`Wallet initialized for user ${payload.userId}`);
    } catch (error) {
      this.logger.error(
        `Failed to initialize wallet for user ${payload.userId}: ${error.message}`,
      );
    }
  }
}
