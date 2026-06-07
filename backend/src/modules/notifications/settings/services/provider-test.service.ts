import { Injectable } from '@nestjs/common';

@Injectable()
export class ProviderTestService {
  async testConnection(payload: any) {
    return {
      success: true,
      channel: payload.channel,
      message: 'Provider test endpoint reachable',
    };
  }
}
