import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class ZohoEmailService {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  async sendTestEmail(to: string) {
    const result = await this.transporter.sendMail({
     from: process.env.EMAIL_FROM,
      to,
      subject: 'SchoolOS Provider Test',
      html: `
        <h2>SchoolOS Email Test</h2>
        <p>Your Zoho email configuration is working.</p>
      `,
    });

    return {
      success: true,
      provider: 'ZOHO',
      messageId: result.messageId,
    };
  }
}
