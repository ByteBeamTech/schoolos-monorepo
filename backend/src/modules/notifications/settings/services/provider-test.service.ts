import { Injectable } from '@nestjs/common';

import { ZohoEmailService }
from '../../providers/email/zoho-email.service';

@Injectable()
export class ProviderTestService {
  constructor(
    private readonly zohoEmail: ZohoEmailService,
  ) {}

  async testConnection(payload: any) {

    if (
      payload.channel === 'EMAIL' &&
      payload.email
    ) {
      return this.zohoEmail.sendTestEmail(
        payload.email,
      );
    }

    return {
      success: false,
      message: 'Channel not supported yet',
    };
  }
}
