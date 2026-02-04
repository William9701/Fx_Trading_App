import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({
    description: 'Registered email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: '6-digit OTP sent to your email',
    example: '123456',
  })
  @IsString({ message: 'OTP must be a string' })
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  otp: string;
}
