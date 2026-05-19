import {
  Controller,
  Post,
} from '@nestjs/common';

import {
  NotificationDispatcherService,
} from '../dispatcher/notification-dispatcher.service';

import {
  NOTIFICATION_EVENTS,
} from '../events/notification-events.constants';

@Controller('notification-testing')
export class NotificationTestingController {
  constructor(
    private readonly dispatcher:
      NotificationDispatcherService,
  ) {}

  @Post('otp')
  async testOtp() {
    await this.dispatcher.dispatch(
      NOTIFICATION_EVENTS.USER_LOGIN_OTP,
      {
        to: 'vibhakar8@gmail.com',

        subject: 'SchoolOS OTP Test',

        templateData: {
          otp: '482913',

          validityMinutes: 10,
        },
      },
    );

    return {
      success: true,

      message:
        'OTP notification queued',
    };
  }

  @Post('fee-reminder')
  async testFeeReminder() {
    await this.dispatcher.dispatch(
      NOTIFICATION_EVENTS.FEE_REMINDER,
      {
        to: 'vibhakar8@gmail.com',

        subject: 'Fee Reminder',

        templateData: {
          studentName:
            'Rahul Sharma',

          amount: 4500,

          dueDate:
            '20 May 2026',

          schoolName:
            'Byte Beam School',
        },
      },
    );

    return {
      success: true,

      message:
        'Fee reminder queued',
    };
  }
}
