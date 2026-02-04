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
        const redisUrl = process.env.REDIS_URL;

        let store;
        if (redisUrl) {
          // Parse the URL into explicit ioredis options.
          // cache-manager-ioredis-yet does NOT support a bare { url } key —
          // it must receive host/port/password/tls that ioredis understands.
          // Render's rediss:// URL requires tls:{} to be set explicitly.
          const parsed = new URL(redisUrl);
          store = await redisStore({
            host: parsed.hostname,
            port: parsed.port ? parseInt(parsed.port, 10) : 6379,
            password: parsed.password || undefined,
            tls: parsed.protocol === 'rediss:' ? {} : undefined,
          });
        } else {
          // Fallback for local Docker — top-level ioredis options.
          const redisConfig = configService.get<{
            host: string;
            port: number;
            password?: string;
          }>('redis');

          store = await redisStore({
            host: redisConfig.host,
            port: redisConfig.port,
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
