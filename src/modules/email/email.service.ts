import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface EmailJobData {
  to: string;
  subject: string;
  template: 'otp' | 'welcome' | 'transaction';
  context: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendOtpEmail(to: string, otp: string): Promise<void> {
    try {
      await this.emailQueue.add(
        'send-email',
        {
          to,
          subject: 'Verify Your Email - FX Trading',
          template: 'otp',
          context: { otp },
        } as EmailJobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      this.logger.log(`OTP email queued for ${to}`);
    } catch (error) {
      this.logger.error(`Failed to queue OTP email: ${error.message}`);
      throw error;
    }
  }

  async sendWelcomeEmail(to: string, name: string): Promise<void> {
    try {
      await this.emailQueue.add(
        'send-email',
        {
          to,
          subject: 'Welcome to FX Trading',
          template: 'welcome',
          context: { name },
        } as EmailJobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      this.logger.log(`Welcome email queued for ${to}`);
    } catch (error) {
      this.logger.error(`Failed to queue welcome email: ${error.message}`);
    }
  }

  async sendTransactionEmail(
    to: string,
    transactionDetails: Record<string, any>,
  ): Promise<void> {
    try {
      await this.emailQueue.add(
        'send-email',
        {
          to,
          subject: 'Transaction Notification - FX Trading',
          template: 'transaction',
          context: transactionDetails,
        } as EmailJobData,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );
      this.logger.log(`Transaction email queued for ${to}`);
    } catch (error) {
      this.logger.error(
        `Failed to queue transaction email: ${error.message}`,
      );
    }
  }
}
