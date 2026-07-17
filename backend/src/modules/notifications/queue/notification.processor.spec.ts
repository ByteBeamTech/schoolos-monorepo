// backend/src/modules/notifications/queue/notification.processor.spec.ts
//
// PR-5F: no spec file existed for NotificationProcessor before this PR.
// Narrow by design -- guards the SMS/WhatsApp commercial-entitlement
// wiring specifically (the single enforcement point every producer's
// job converges on, per the PR-5F audit), plus the "no retry on
// commercial denial" contract (return, never throw, on denial) and the
// "Email is unaffected" requirement. Not full processor coverage.

import { Test, TestingModule } from '@nestjs/testing';
import { NotificationProcessor } from './notification.processor';
import { PrismaService } from '@infra/database/prisma.service';
import { EmailChannel } from '../channels/email.channel';
import { SmsChannel } from '../channels/sms.channel';
import { WhatsAppChannel } from '../channels/whatsapp.channel';
import { PushChannel } from '../channels/push/push.channel';
import { EntitlementResolver } from '@core/license/entitlement-resolver.service';
import { Job } from 'bull';
import { NotificationJob } from './notification.processor';

describe('NotificationProcessor', () => {
  let processor: NotificationProcessor;

  const mockPrismaService = {
    notification: { update: jest.fn() },
  };

  const mockEmailChannel    = { send: jest.fn() };
  const mockSmsChannel      = { send: jest.fn(), formatPhone: jest.fn((p: string) => p) };
  const mockWhatsAppChannel = { send: jest.fn() };
  const mockPushChannel     = { send: jest.fn() };

  const mockEntitlementResolver = {
    hasFeature: jest.fn(),
  };

  const makeJob = (data: Partial<NotificationJob>): Job<NotificationJob> => ({
    data: {
      notificationId: 'notif-1',
      tenantId:       't-1',
      channel:        'SMS',
      to:             '+919999999999',
      body:           'Test message',
      ...data,
    },
  } as Job<NotificationJob>);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationProcessor,
        { provide: PrismaService,          useValue: mockPrismaService },
        { provide: EmailChannel,           useValue: mockEmailChannel },
        { provide: SmsChannel,             useValue: mockSmsChannel },
        { provide: WhatsAppChannel,        useValue: mockWhatsAppChannel },
        { provide: PushChannel,            useValue: mockPushChannel },
        { provide: EntitlementResolver,    useValue: mockEntitlementResolver },
      ],
    }).compile();

    processor = module.get<NotificationProcessor>(NotificationProcessor);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('SMS', () => {
    it('purchased: entitled tenant -> delivered, status SENT', async () => {
      mockEntitlementResolver.hasFeature.mockResolvedValue(true);
      mockSmsChannel.send.mockResolvedValue(true);

      await processor.handleSend(makeJob({ channel: 'SMS' }));

      expect(mockEntitlementResolver.hasFeature).toHaveBeenCalledWith('t-1', 'sms');
      expect(mockSmsChannel.send).toHaveBeenCalled();
      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({ status: 'SENT' }),
      });
    });

    it('not purchased: denied tenant -> CANCELLED, LICENSE_DENIED reason, channel never called, no throw', async () => {
      mockEntitlementResolver.hasFeature.mockResolvedValue(false);

      await expect(processor.handleSend(makeJob({ channel: 'SMS' }))).resolves.not.toThrow();

      expect(mockSmsChannel.send).not.toHaveBeenCalled();
      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: {
          status:     'CANCELLED',
          failReason: 'LICENSE_DENIED: SMS not included in current subscription.',
        },
      });
      // Exactly one update call -- the denial path returns before the
      // generic post-switch SENT/FAILED update runs, so no second,
      // conflicting status write happens for the same notification.
      expect(mockPrismaService.notification.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('WhatsApp', () => {
    it('purchased: entitled tenant -> delivered, status SENT', async () => {
      mockEntitlementResolver.hasFeature.mockResolvedValue(true);
      mockWhatsAppChannel.send.mockResolvedValue(true);

      await processor.handleSend(makeJob({ channel: 'WHATSAPP' }));

      expect(mockEntitlementResolver.hasFeature).toHaveBeenCalledWith('t-1', 'whatsapp');
      expect(mockWhatsAppChannel.send).toHaveBeenCalled();
      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({ status: 'SENT' }),
      });
    });

    it('not purchased: denied tenant -> CANCELLED, LICENSE_DENIED reason, channel never called, no throw', async () => {
      mockEntitlementResolver.hasFeature.mockResolvedValue(false);

      await expect(processor.handleSend(makeJob({ channel: 'WHATSAPP' }))).resolves.not.toThrow();

      expect(mockWhatsAppChannel.send).not.toHaveBeenCalled();
      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: {
          status:     'CANCELLED',
          failReason: 'LICENSE_DENIED: WhatsApp not included in current subscription.',
        },
      });
      expect(mockPrismaService.notification.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('Email (must be unaffected by PR-5F)', () => {
    it('never calls EntitlementResolver and always attempts delivery', async () => {
      mockEmailChannel.send.mockResolvedValue(true);

      await processor.handleSend(makeJob({ channel: 'EMAIL', to: 'a@b.com', subject: 'Hi' }));

      expect(mockEntitlementResolver.hasFeature).not.toHaveBeenCalled();
      expect(mockEmailChannel.send).toHaveBeenCalled();
      expect(mockPrismaService.notification.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: expect.objectContaining({ status: 'SENT' }),
      });
    });
  });
});
