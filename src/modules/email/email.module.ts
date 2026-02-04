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
        const redisConfig = configService.get<{
          host: string;
          port: number;
          password?: string;
          tls?: object;
        }>('redis');

        return {
          redis: {
            host: redisConfig.host,
            port: redisConfig.port,
            password: redisConfig.password,
            // Managed Redis (Render/Upstash) requires TLS; local Docker does not.
            tls: redisConfig.tls !== undefined ? redisConfig.tls : undefined,
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
