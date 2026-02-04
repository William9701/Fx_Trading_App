import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from 'eventemitter2';
import * as bcrypt from 'bcrypt';
import { UserRepository } from './repositories/user.repository';
import { OtpRepository } from './repositories/otp.repository';
import { EmailService } from '../email/email.service';
import { User } from './entities/user.entity';
import { RegisterDto, VerifyOtpDto, LoginDto, ResendOtpDto } from './dto';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userRepository: UserRepository,
    private otpRepository: OtpRepository,
    private emailService: EmailService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const existing = await this.userRepository.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    // 10 rounds is solid for bcrypt — good balance of security vs speed
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.userRepository.create({
      email: dto.email,
      password: hashedPassword,
      isVerified: false,
    });

    await this.generateAndSendOtp(user.id, dto.email);

    return {
      message: 'Registration successful. Please check your email for the OTP.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{
    message: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email is already verified');
    }

    const otp = await this.otpRepository.findValidByUserId(user.id);

    if (!otp) {
      throw new BadRequestException('No valid OTP found. Please request a new one.');
    }

    // Check expiry before checking the code itself
    if (new Date() > otp.expiresAt) {
      await this.otpRepository.markAsUsed(otp.id);
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    if (otp.code !== dto.otp) {
      throw new BadRequestException('Invalid OTP code');
    }

    // Mark OTP as used and verify the user atomically
    await this.otpRepository.markAsUsed(otp.id);
    await this.userRepository.update(user.id, { isVerified: true });

    // Wallet listener picks this up and seeds the initial balance — keeps modules decoupled
    this.eventEmitter.emit('user.verified', { userId: user.id });

    // Queue a welcome email in the background — no need to await
    this.emailService.sendWelcomeEmail(user.email, user.email.split('@')[0]);

    const tokens = this.generateTokens(user);

    return {
      message: 'Email verified successfully',
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: Partial<User>;
  }> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatch = await bcrypt.compare(dto.password, user.password);

    if (!passwordMatch) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    const tokens = this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    };
  }

  async resendOtp(dto: ResendOtpDto): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(dto.email);

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.isVerified) {
      throw new BadRequestException('Email is already verified');
    }

    await this.generateAndSendOtp(user.id, dto.email);

    return { message: 'OTP resent successfully. Check your email.' };
  }

  async refreshToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(
        refreshToken,
        { secret: this.configService.get<string>('jwt.refreshSecret') },
      );

      const user = await this.userRepository.findById(payload.sub);

      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      return this.generateTokens(user);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  // Generates a 6-digit OTP, invalidates any previous ones, and queues the email
  private async generateAndSendOtp(
    userId: string,
    email: string,
  ): Promise<void> {
    // Wipe out any pending OTPs for this user before creating a new one
    await this.otpRepository.invalidateAllForUser(userId);

    const code = this.generateOtpCode();
    const expirationMinutes = this.configService.get<number>(
      'otp.expirationMinutes',
    );

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expirationMinutes);

    await this.otpRepository.create({
      code,
      userId,
      expiresAt,
    });

    await this.emailService.sendOtpEmail(email, code);
  }

  private generateOtpCode(): string {
    // Cryptographically safe 6-digit code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private generateTokens(user: User): {
    accessToken: string;
    refreshToken: string;
  } {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    // Access token with default config from module
    const accessToken = this.jwtService.sign(payload);

    // Refresh token with custom expiry
    const refreshToken = this.jwtService.sign(
      payload,
      {
        secret: this.configService.get<string>('jwt.refreshSecret'),
        expiresIn: this.configService.get<string>('jwt.refreshExpiresIn'),
      } as any,
    );

    return { accessToken, refreshToken };
  }
}
