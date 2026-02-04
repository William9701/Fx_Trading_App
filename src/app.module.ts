import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import configuration from './config/configuration';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { FxRateModule } from './modules/fx-rate/fx-rate.module';
import { TransactionModule } from './modules/transaction/transaction.module';
import { HealthController } from './common/health/health.controller';

@Module({
  imports: [
    // Config is global so every module can pull env vars without re-importing
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),

    // Database connection is async because it depends on ConfigService
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => getDatabaseConfig(configService),
      inject: [ConfigService],
    }),

    // Event bus — auth emits, wallet listens. Keeps modules decoupled.
    EventEmitterModule.forRoot(),

    AuthModule,
    FxRateModule,
    WalletModule,
    TransactionModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
