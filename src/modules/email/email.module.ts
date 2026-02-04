import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailProcessor } from './email.processor';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // REDIS_URL is set by Render's fromService reference (redis://red-xxx:6379).
        // ioredis accepts a connection URL directly — no need to parse host/port manually.
        const redisUrl = process.env.REDIS_URL;

        if (redisUrl) {
          return { redis: { url: redisUrl } };
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
