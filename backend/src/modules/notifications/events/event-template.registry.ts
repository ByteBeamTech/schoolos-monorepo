import {
  NOTIFICATION_EVENTS,
} from './notification-events.constants';

export const EVENT_TEMPLATE_REGISTRY = {
  [NOTIFICATION_EVENTS.USER_LOGIN_OTP]:
    'otp',

  [NOTIFICATION_EVENTS.PASSWORD_RESET_OTP]:
    'otp',

  [NOTIFICATION_EVENTS.FEE_REMINDER]:
    'fee-reminder',

  [NOTIFICATION_EVENTS.ANNOUNCEMENT]:
    'announcement',
};

