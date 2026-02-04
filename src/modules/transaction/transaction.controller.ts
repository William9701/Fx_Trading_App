import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { JwtAuthGuard, VerifiedGuard } from '@common/guards';
import { CurrentUser } from '@common/decorators';
import { User } from '../auth/entities/user.entity';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard, VerifiedGuard)
@ApiBearerAuth()
export class TransactionController {
  constructor(private transactionService: TransactionService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get paginated transaction history for current user' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['funding', 'conversion', 'trade', 'withdrawal'],
  })
  @ApiResponse({ status: 200, description: 'Paginated transaction list' })
  async getTransactions(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
  ) {
    return this.transactionService.getTransactions(user.id, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      type,
    });
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get a single transaction by ID (must belong to current user)' })
  @ApiResponse({ status: 200, description: 'Transaction details' })
  @ApiResponse({ status: 404, description: 'Transaction not found' })
  async getTransaction(@CurrentUser() user: User, @Param('id') id: string) {
    const transaction = await this.transactionService.getTransactionById(id);

    if (!transaction || transaction.userId !== user.id) {
      throw new NotFoundException('Transaction not found');
    }

    return transaction;
  }
}
