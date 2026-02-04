import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Otp } from '../entities/otp.entity';

@Injectable()
export class OtpRepository {
  constructor(
    @InjectRepository(Otp)
    private readonly repository: Repository<Otp>,
  ) {}

  async create(data: Partial<Otp>): Promise<Otp> {
    const otp = this.repository.create(data);
    return this.repository.save(otp);
  }

  // Grab the most recent unused OTP for a given user
  async findValidByUserId(userId: string): Promise<Otp | null> {
    return this.repository.findOne({
      where: {
        userId,
        isUsed: false,
      },
      order: { createdAt: 'DESC' },
    });
  }

  async markAsUsed(id: string): Promise<void> {
    await this.repository.update(id, { isUsed: true });
  }

  // Clean up old OTPs when issuing a new one
  async invalidateAllForUser(userId: string): Promise<void> {
    await this.repository
      .createQueryBuilder()
      .update(Otp)
      .set({ isUsed: true })
      .where('userId = :userId AND isUsed = :isUsed', {
        userId,
        isUsed: false,
      })
      .execute();
  }
}
