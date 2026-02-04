import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { FundWalletDto, ConvertWalletDto, TradeWalletDto } from './dto';
import { JwtAuthGuard, VerifiedGuard } from '@common/guards';
import { CurrentUser } from '@common/decorators';
import { User } from '../auth/entities/user.entity';

@ApiTags('Wallet')
@Controller('wallet')
@UseGuards(JwtAuthGuard, VerifiedGuard)
@ApiBearerAuth()
export class WalletController {
  constructor(private walletService: WalletService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get all wallet balances for the authenticated user' })
  @ApiResponse({ status: 200, description: 'List of wallets with balances' })
  async getWallets(@CurrentUser() user: User) {
    const wallets = await this.walletService.getWallets(user.id);
    return {
      wallets: wallets.map((w) => ({
        currency: w.currency,
        balance: Number(w.balance),
      })),
    };
  }

  @Post('fund')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Fund wallet in NGN or another supported currency' })
  @ApiResponse({ status: 201, description: 'Wallet funded successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async fundWallet(@CurrentUser() user: User, @Body() dto: FundWalletDto) {
    return this.walletService.fundWallet(user.id, dto);
  }

  @Post('convert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Convert between currencies using real-time FX rates' })
  @ApiResponse({ status: 200, description: 'Conversion successful' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or invalid currencies' })
  async convertCurrency(@CurrentUser() user: User, @Body() dto: ConvertWalletDto) {
    return this.walletService.convertCurrency(user.id, dto);
  }

  @Post('trade')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trade NGN against another currency or vice versa' })
  @ApiResponse({ status: 200, description: 'Trade executed successfully' })
  @ApiResponse({ status: 400, description: 'Insufficient balance or invalid pair' })
  async trade(@CurrentUser() user: User, @Body() dto: TradeWalletDto) {
    return this.walletService.trade(user.id, dto);
  }
}
