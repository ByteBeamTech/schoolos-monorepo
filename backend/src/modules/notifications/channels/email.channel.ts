import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';

export interface EmailPayload {
  to:      string;
  subject: string;
  body:    string;
  html?:   string;
}

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(EmailChannel.name);
  private readonly from:   string;
  private readonly apiKey: string;

  constructor(config: ConfigService) {
    this.from   = config.get<string>('SENDGRID_FROM_EMAIL', 'noreply@schoolos.com');
    this.apiKey = config.get<string>('SENDGRID_API_KEY', '');
  }

  async send(payload: EmailPayload): Promise<boolean> {
    if (!this.apiKey || this.apiKey.includes('xxxxxxxxxx')) {
      this.logger.warn(`[EMAIL STUB] To: ${payload.to} | Subject: ${payload.subject}`);
      this.logger.debug(`[EMAIL STUB] Body: ${payload.body.substring(0, 100)}...`);
      return true; // Stub returns true in dev
    }

    try {
      const sgMail = require('@sendgrid/mail');
      sgMail.setApiKey(this.apiKey);
      await sgMail.send({
        to:      payload.to,
        from:    this.from,
        subject: payload.subject,
        text:    payload.body,
        html:    payload.html ?? payload.body.replace(/\n/g, '<br>'),
      });
      this.logger.log(`Email sent to ${payload.to}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Email failed to ${payload.to}: ${err.message}`);
      return false;
    }
  }
}
