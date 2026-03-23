import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';

export interface SmsPayload {
  to:   string; // E.164 format: +919876543210
  body: string;
}

@Injectable()
export class SmsChannel {
  private readonly logger:      Logger = new Logger(SmsChannel.name);
  private readonly accountSid:  string;
  private readonly authToken:   string;
  private readonly fromNumber:  string;

  constructor(config: ConfigService) {
    this.accountSid = config.get<string>('TWILIO_ACCOUNT_SID', '');
    this.authToken  = config.get<string>('TWILIO_AUTH_TOKEN', '');
    this.fromNumber = config.get<string>('TWILIO_FROM_NUMBER', '');
  }

  async send(payload: SmsPayload): Promise<boolean> {
    if (!this.accountSid || this.accountSid.includes('xxxxxxxxxx')) {
      this.logger.warn(`[SMS STUB] To: ${payload.to} | Body: ${payload.body.substring(0, 60)}...`);
      return true;
    }

    try {
      const twilio = require('twilio');
      const client = twilio(this.accountSid, this.authToken);
      await client.messages.create({
        to:   payload.to,
        from: this.fromNumber,
        body: payload.body,
      });
      this.logger.log(`SMS sent to ${payload.to}`);
      return true;
    } catch (err: any) {
      this.logger.error(`SMS failed to ${payload.to}: ${err.message}`);
      return false;
    }
  }

  formatPhone(phone: string): string {
    // Ensure E.164 format
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('91') && cleaned.length === 12) return `+${cleaned}`;
    if (cleaned.length === 10) return `+91${cleaned}`; // India default
    return `+${cleaned}`;
  }
}
