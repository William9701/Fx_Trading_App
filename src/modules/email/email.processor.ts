import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bull';
import * as nodemailer from 'nodemailer';
import { EmailJobData } from './email.service';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    // Initialize nodemailer transporter
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('email.smtp.host'),
      port: this.configService.get<number>('email.smtp.port'),
      secure: this.configService.get<boolean>('email.smtp.secure'),
      auth: {
        user: this.configService.get<string>('email.smtp.auth.user'),
        pass: this.configService.get<string>('email.smtp.auth.pass'),
      },
    });
  }

  @Process('send-email')
  async handleSendEmail(job: Job<EmailJobData>): Promise<void> {
    const { to, subject, template, context } = job.data;

    try {
      const html = this.getEmailTemplate(template, context);

      await this.transporter.sendMail({
        from: this.configService.get<string>('email.from'),
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${error.message}`);
      throw error;
    }
  }

  private getEmailTemplate(
    template: string,
    context: Record<string, any>,
  ): string {
    switch (template) {
      case 'otp':
        return this.getOtpTemplate(context.otp);
      case 'welcome':
        return this.getWelcomeTemplate(context.name);
      case 'transaction':
        return this.getTransactionTemplate(context);
      default:
        return '<p>Default email template</p>';
    }
  }

  private getOtpTemplate(otp: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .otp-code { font-size: 32px; font-weight: bold; color: #4CAF50; text-align: center; padding: 20px; background-color: white; border-radius: 5px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email Verification</h1>
          </div>
          <div class="content">
            <p>Thank you for registering with FX Trading!</p>
            <p>Please use the following OTP to verify your email address:</p>
            <div class="otp-code">${otp}</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} FX Trading. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getWelcomeTemplate(name: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to FX Trading!</h1>
          </div>
          <div class="content">
            <p>Hello ${name || 'Trader'},</p>
            <p>Your account has been successfully verified!</p>
            <p>You can now start trading currencies and managing your wallet.</p>
            <p>We've credited your account with an initial balance to get you started.</p>
            <p>Happy trading!</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} FX Trading. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getTransactionTemplate(context: Record<string, any>): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .transaction-details { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Transaction Notification</h1>
          </div>
          <div class="content">
            <p>A transaction has been processed on your account.</p>
            <div class="transaction-details">
              <p><strong>Type:</strong> ${context.type}</p>
              <p><strong>Amount:</strong> ${context.amount} ${context.currency}</p>
              <p><strong>Status:</strong> ${context.status}</p>
              <p><strong>Date:</strong> ${new Date(context.date).toLocaleString()}</p>
            </div>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} FX Trading. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
