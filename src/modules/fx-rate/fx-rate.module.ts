import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-ioredis-yet';
import { FxRateService } from './fx-rate.service';
import { FxRateController } from './fx-rate.controller';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: () => ({
        timeout: 10000,
        maxRedirects: 3,
      }),
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      isGlobal: true,
      useFactory: async (configService: ConfigService) => {
        const redisConfig = configService.get<{
          host: string;
          port: number;
          password?: string;
          tls?: object;
        }>('redis');

        // redisStore wraps ioredis into a cache-manager-compatible store.
        // When tls is set (rediss:// URLs from Render/Upstash) it enables TLS.
        const store = await redisStore({
          socket: {
            host: redisConfig.host,
            port: redisConfig.port,
            tls: redisConfig.tls !== undefined,
          },
          password: redisConfig.password || undefined,
        });

        return {
          store,
          ttl: configService.get<number>('fxRate.cacheTtl'),
        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [FxRateService],
  controllers: [FxRateController],
  exports: [FxRateService],
})
export class FxRateModule {}
