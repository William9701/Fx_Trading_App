import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from 'eventemitter2';
import {
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UserRepository } from './repositories/user.repository';
import { OtpRepository } from './repositories/otp.repository';
import { EmailService } from '../email/email.service';
import { DirectEmailService } from '../email/direct-email.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: jest.Mocked<UserRepository>;
  let otpRepo: jest.Mocked<OtpRepository>;
  let emailService: jest.Mocked<EmailService>;
  let jwtService: jest.Mocked<JwtService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockUser = {
    id: 'test-uuid',
    email: 'test@example.com',
    password: 'hashed-password',
    isVerified: false,
    isActive: true,
    role: 'user',
    createdAt: new Date(),
    updatedAt: new Date(),
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: OtpRepository,
          useValue: {
            create: jest.fn(),
            findValidByUserId: jest.fn(),
            markAsUsed: jest.fn(),
            invalidateAllForUser: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendOtpEmail: jest.fn(),
            sendWelcomeEmail: jest.fn(),
          },
        },
        {
          provide: DirectEmailService,
          useValue: {
            sendOtpEmail: jest.fn(),
            sendWelcomeEmail: jest.fn(),
            sendTransactionEmail: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              const map = {
                'node_env': 'development',
                'jwt.secret': 'test-secret',
                'jwt.expiresIn': '1h',
                'jwt.refreshSecret': 'test-refresh-secret',
                'jwt.refreshExpiresIn': '7d',
                'otp.expirationMinutes': 10,
              };
              return map[key];
            }),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get(UserRepository);
    otpRepo = module.get(OtpRepository);
    emailService = module.get(EmailService);
    jwtService = module.get(JwtService);
    eventEmitter = module.get(EventEmitter2);
  });

  describe('register', () => {
    it('should register a new user and send OTP', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      userRepo.create.mockResolvedValue(mockUser);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      otpRepo.invalidateAllForUser.mockResolvedValue();
      otpRepo.create.mockResolvedValue({ code: '123456' } as any);
      emailService.sendOtpEmail.mockResolvedValue();

      const result = await service.register({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      expect(result.message).toContain('Registration successful');
      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'test@example.com' }),
      );
      expect(emailService.sendOtpEmail).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({ email: 'test@example.com', password: 'Pass1234!' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('verifyOtp', () => {
    it('should verify OTP and return tokens', async () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 10);

      userRepo.findByEmail.mockResolvedValue(mockUser);
      otpRepo.findValidByUserId.mockResolvedValue({
        id: 'otp-uuid',
        code: '123456',
        expiresAt: futureDate,
        isUsed: false,
      } as any);
      otpRepo.markAsUsed.mockResolvedValue();
      userRepo.update.mockResolvedValue({ ...mockUser, isVerified: true });

      const result = await service.verifyOtp({
        email: 'test@example.com',
        otp: '123456',
      });

      expect(result.message).toBe('Email verified successfully');
      expect(result.accessToken).toBe('mock-token');
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.verified', {
        userId: mockUser.id,
      });
    });

    it('should throw if OTP is expired', async () => {
      const pastDate = new Date();
      pastDate.setMinutes(pastDate.getMinutes() - 15);

      userRepo.findByEmail.mockResolvedValue(mockUser);
      otpRepo.findValidByUserId.mockResolvedValue({
        id: 'otp-uuid',
        code: '123456',
        expiresAt: pastDate,
        isUsed: false,
      } as any);

      await expect(
        service.verifyOtp({ email: 'test@example.com', otp: '123456' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if OTP code is wrong', async () => {
      const futureDate = new Date();
      futureDate.setMinutes(futureDate.getMinutes() + 10);

      userRepo.findByEmail.mockResolvedValue(mockUser);
      otpRepo.findValidByUserId.mockResolvedValue({
        id: 'otp-uuid',
        code: '123456',
        expiresAt: futureDate,
        isUsed: false,
      } as any);

      await expect(
        service.verifyOtp({ email: 'test@example.com', otp: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should return tokens on valid credentials', async () => {
      const verifiedUser = { ...mockUser, isVerified: true };
      userRepo.findByEmail.mockResolvedValue(verifiedUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.login({
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw if password is wrong', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if user is not verified', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser); // isVerified: false
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(
        service.login({ email: 'test@example.com', password: 'SecurePass123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('resendOtp', () => {
    it('should resend OTP for unverified user', async () => {
      userRepo.findByEmail.mockResolvedValue(mockUser);
      otpRepo.invalidateAllForUser.mockResolvedValue();
      otpRepo.create.mockResolvedValue({} as any);
      emailService.sendOtpEmail.mockResolvedValue();

      const result = await service.resendOtp({ email: 'test@example.com' });
      expect(result.message).toContain('OTP resent');
    });

    it('should throw if user is already verified', async () => {
      userRepo.findByEmail.mockResolvedValue({
        ...mockUser,
        isVerified: true,
      });

      await expect(
        service.resendOtp({ email: 'test@example.com' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
