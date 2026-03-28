// modules/notifications/channels/push/push.channel.ts
// FCM push notification channel using Firebase Admin SDK.
// Env vars required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PushPayload {
  to:       string;  // FCM device token
  title:    string;
  body:     string;
  data?:    Record<string, string>;
  imageUrl?: string;
}

@Injectable()
export class PushChannel implements OnModuleInit {
  private readonly logger = new Logger(PushChannel.name);
  private messaging: any = null;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const projectId   = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey  = this.config.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      this.logger.warn('Firebase credentials not configured — push notifications disabled');
      return;
    }

    try {
      // Lazy import to avoid startup crash if firebase-admin not installed
      const admin = await import('firebase-admin');

      if (!admin.default.apps.length) {
        admin.default.initializeApp({
          credential: admin.default.credential.cert({ projectId, clientEmail, privateKey }),
        });
      }

      this.messaging = admin.default.messaging();
      this.logger.log('Firebase Admin SDK initialised — push notifications enabled');
    } catch (err: any) {
      this.logger.error(`Failed to init Firebase: ${err.message}`);
    }
  }

  async send(payload: PushPayload): Promise<boolean> {
    if (!this.messaging) {
      this.logger.warn(`[PushChannel] Not configured — skipping push to ${payload.to.slice(0, 8)}...`);
      return false;
    }

    try {
      const message = {
        token: payload.to,
        notification: {
          title: payload.title,
          body:  payload.body,
          ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
        },
        data: payload.data ?? {},
        android: {
          priority: 'high' as const,
          notification: { sound: 'default', clickAction: 'FLUTTER_NOTIFICATION_CLICK' },
        },
        apns: {
          payload: { aps: { sound: 'default', badge: 1 } },
        },
      };

      const response = await this.messaging.send(message);
      this.logger.debug(`[PushChannel] Sent: ${response}`);
      return true;
    } catch (err: any) {
      this.logger.error(`[PushChannel] Failed: ${err.message}`);

      // Token expired / invalid — caller should remove token from DB
      if (err.code === 'messaging/registration-token-not-registered') {
        this.logger.warn(`[PushChannel] Stale FCM token: ${payload.to.slice(0, 8)}...`);
      }
      return false;
    }
  }

  async sendMulticast(tokens: string[], title: string, body: string, data?: Record<string, string>): Promise<{ success: number; failure: number }> {
    if (!this.messaging || tokens.length === 0) return { success: 0, failure: tokens.length };

    try {
      const message = {
        tokens,
        notification: { title, body },
        data: data ?? {},
        android: { priority: 'high' as const },
        apns:    { payload: { aps: { sound: 'default' } } },
      };

      const response = await this.messaging.sendEachForMulticast(message);
      this.logger.log(`[PushChannel] Multicast: ${response.successCount} ok, ${response.failureCount} failed`);
      return { success: response.successCount, failure: response.failureCount };
    } catch (err: any) {
      this.logger.error(`[PushChannel] Multicast failed: ${err.message}`);
      return { success: 0, failure: tokens.length };
    }
  }
}
