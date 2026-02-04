import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

/**
 * Parse a redis:// or rediss:// URL into the ioredis options object that
 * BullMQ actually understands.  Render's free-tier keyvalue service returns
 * a rediss:// URL — ioredis needs explicit { tls: {} } for that to work;
 * a bare { url } key is silently ignored by BullMQ's redis option.
 */
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? parseInt(parsed.port, 10) : 6379,
    password: parsed.password || undefined,
    tls: parsed.protocol === 'rediss:' ? {} : undefined,
  };
}

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = process.env.REDIS_URL;

        if (redisUrl) {
          // Spread the parsed URL into ioredis-compatible options.
          // This correctly sets tls:{} when the scheme is rediss://.
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
          },
        };
      },
      inject: [ConfigService],
    }),
    BullModule.registerQueue({
      name: 'email',
    }),
  ],
  providers: [EmailService, EmailProcessor],
  exports: [EmailService],
})
export class EmailModule {}
