import { Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';

export interface WhatsAppPayload {
  to:   string; // E.164 format
  body: string;
}

@Injectable()
export class WhatsAppChannel {
  private readonly logger:      Logger = new Logger(WhatsAppChannel.name);
  private readonly accountSid:  string;
  private readonly authToken:   string;
  private readonly fromNumber:  string;

  constructor(config: ConfigService) {
    this.accountSid = config.get<string>('TWILIO_ACCOUNT_SID', '');
    this.authToken  = config.get<string>('TWILIO_AUTH_TOKEN', '');
    this.fromNumber = config.get<string>('TWILIO_WHATSAPP_NUMBER', 'whatsapp:+14155238886'); // Twilio sandbox
  }

  async send(payload: WhatsAppPayload): Promise<boolean> {
    if (!this.accountSid || this.accountSid.includes('xxxxxxxxxx')) {
      this.logger.warn(`[WHATSAPP STUB] To: ${payload.to} | Body: ${payload.body.substring(0, 60)}...`);
      return true;
    }

    try {
      const twilio = require('twilio');
      const client = twilio(this.accountSid, this.authToken);
      await client.messages.create({
        to:   `whatsapp:${payload.to}`,
        from: this.fromNumber,
        body: payload.body,
      });
      this.logger.log(`WhatsApp sent to ${payload.to}`);
      return true;
    } catch (err: any) {
      this.logger.error(`WhatsApp failed to ${payload.to}: ${err.message}`);
      return false;
    }
  }
}
