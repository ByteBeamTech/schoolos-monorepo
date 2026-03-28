// core/localization/localization.service.ts
import { Injectable } from '@nestjs/common';

export type SupportedLocale   = 'en-IN' | 'en-US' | 'en-GB' | 'ar-AE';
export type SupportedTimezone = 'Asia/Kolkata' | 'America/New_York' | 'Europe/London' | 'Asia/Dubai' | 'UTC';

const REGION_DEFAULTS: Record<string, { locale: SupportedLocale; timezone: SupportedTimezone; currency: string }> = {
  IN:     { locale: 'en-IN', timezone: 'Asia/Kolkata',      currency: 'INR' },
  US:     { locale: 'en-US', timezone: 'America/New_York',  currency: 'USD' },
  EU:     { locale: 'en-GB', timezone: 'Europe/London',     currency: 'EUR' },
  UK:     { locale: 'en-GB', timezone: 'Europe/London',     currency: 'GBP' },
  GLOBAL: { locale: 'en-US', timezone: 'UTC',               currency: 'USD' },
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹', USD: '$', GBP: '£', EUR: '€', AED: 'د.إ',
};

@Injectable()
export class LocalizationService {

  // ─── Region defaults ────────────────────────────────────────────────────────

  getRegionDefaults(region: string) {
    return REGION_DEFAULTS[region] ?? REGION_DEFAULTS['GLOBAL'];
  }

  // ─── Currency formatting ────────────────────────────────────────────────────

  formatCurrency(amount: number, currency: string, locale?: string): string {
    const resolvedLocale = locale ?? this.getLocaleByCurrency(currency);
    return new Intl.NumberFormat(resolvedLocale, {
      style:                 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  getCurrencySymbol(currency: string): string {
    return CURRENCY_SYMBOLS[currency] ?? currency;
  }

  private getLocaleByCurrency(currency: string): string {
    const map: Record<string, string> = {
      INR: 'en-IN', USD: 'en-US', GBP: 'en-GB', EUR: 'de-DE', AED: 'ar-AE',
    };
    return map[currency] ?? 'en-US';
  }

  // ─── Timezone conversion ────────────────────────────────────────────────────

  toTenantTimezone(date: Date, timezone: SupportedTimezone): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone:  timezone,
      year:      'numeric',
      month:     '2-digit',
      day:       '2-digit',
      hour:      '2-digit',
      minute:    '2-digit',
      second:    '2-digit',
      hour12:    false,
    }).format(date);
  }

  nowInTimezone(timezone: SupportedTimezone): Date {
    const str = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).format(new Date());
    return new Date(str);
  }

  // ─── i18n message lookup ────────────────────────────────────────────────────

  t(key: string, locale: SupportedLocale, vars?: Record<string, string | number>): string {
    const msg = MESSAGES[locale]?.[key] ?? MESSAGES['en-US']?.[key] ?? key;
    if (!vars) return msg;
    return Object.entries(vars).reduce(
      (str, [k, v]) => str.replace(`{{${k}}}`, String(v)),
      msg,
    );
  }
}

// ─── i18n message catalogue ──────────────────────────────────────────────────

const MESSAGES: Record<string, Record<string, string>> = {
  'en-US': {
    'invoice.due':           'Invoice {{number}} is due on {{date}}',
    'payment.success':       'Payment of {{amount}} received successfully',
    'payment.failed':        'Payment of {{amount}} failed. Please retry.',
    'attendance.marked':     'Attendance marked for {{date}}',
    'fee.overdue':           'Fee payment of {{amount}} is overdue',
    'trial.expiring':        'Your trial expires in {{days}} days',
    'license.expiring':      'Your license expires in {{days}} days',
    'student.enrolled':      '{{name}} has been enrolled successfully',
    'password.reset':        'Your password has been reset',
  },
  'en-IN': {
    'invoice.due':           'Invoice {{number}} is due on {{date}}',
    'payment.success':       'Payment of {{amount}} received. Thank you!',
    'payment.failed':        'Payment of {{amount}} failed. Kindly retry.',
    'attendance.marked':     'Attendance marked for {{date}}',
    'fee.overdue':           'Fee payment of {{amount}} is overdue. Please pay immediately.',
    'trial.expiring':        'Your trial expires in {{days}} days',
    'license.expiring':      'Your license expires in {{days}} days',
    'student.enrolled':      '{{name}} has been successfully enrolled',
    'password.reset':        'Your password has been reset successfully',
  },
  'en-GB': {
    'invoice.due':           'Invoice {{number}} is due on {{date}}',
    'payment.success':       'Payment of {{amount}} received successfully',
    'payment.failed':        'Payment of {{amount}} failed. Please try again.',
    'attendance.marked':     'Attendance marked for {{date}}',
    'fee.overdue':           'Fee payment of {{amount}} is overdue',
    'trial.expiring':        'Your trial expires in {{days}} days',
    'license.expiring':      'Your licence expires in {{days}} days',
    'student.enrolled':      '{{name}} has been enrolled successfully',
    'password.reset':        'Your password has been reset',
  },
};
