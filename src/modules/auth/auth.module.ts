import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserRepository } from './repositories/user.repository';
import { OtpRepository } from './repositories/otp.repository';
import { JwtStrategy } from './strategies/jwt.strategy';
import { EmailModule } from '../email/email.module';
import { User } from './entities/user.entity';
import { Otp } from './entities/otp.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Otp]),
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.expiresIn') || '1h',
        },
      } as any),
      inject: [ConfigService],
    }),
    EmailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, UserRepository, OtpRepository, JwtStrategy],
  exports: [AuthService, UserRepository, JwtModule],
})
export class AuthModule {}
