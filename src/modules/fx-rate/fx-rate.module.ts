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
        // REDIS_URL is set by Render's fromService (redis://red-xxx:6379).
        // cache-manager-ioredis-yet accepts a url option directly.
        const redisUrl = process.env.REDIS_URL;

        let store;
        if (redisUrl) {
          store = await redisStore({ url: redisUrl });
        } else {
          // Fallback for local Docker.
          const redisConfig = configService.get<{
            host: string;
            port: number;
            password?: string;
          }>('redis');

          store = await redisStore({
            socket: {
              host: redisConfig.host,
              port: redisConfig.port,
            },
            password: redisConfig.password || undefined,
          });
        }

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
