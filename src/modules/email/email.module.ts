import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';
import { DirectEmailService } from './direct-email.service';

/**
 * Parse a redis:// or rediss:// URL into the ioredis options object.
 *
 * - new URL() leaves the password percent-encoded; we must decodeURIComponent
 *   it so ioredis sends the raw password in AUTH.
 * - Render's free-tier keyvalue returns a rediss:// URL; ioredis requires an
 *   explicit tls:{} option to enable TLS — it does NOT infer it from the scheme.
 * - maxRetriesPerRequest: null prevents ioredis from throwing
 *   "Max retries per request limit exceeded" on slow/cold connections.
 */
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = process.env.REDIS_URL;

        if (redisUrl) {
          return { redis: parseRedisUrl(redisUrl) };
        }

        // Fallback for local Docker where REDIS_URL is not set.
        const redisConfig = configService.get<{
          host: string;
          port: number;
          password?: string;
        }>('redis');

        return {
          redis: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            maxRetriesPerRequest: null,
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  providers: [EmailService, EmailProcessor, DirectEmailService],
  exports: [EmailService, DirectEmailService],
})
export class EmailModule {}

