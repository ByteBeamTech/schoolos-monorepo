import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

import { TemplateService } from '../templates/template.service';
import { NotificationEventService } from '../events/notification-event.service';



export interface EmailPayload {
  to: string;

  subject?: string;

  body?: string;

  html?: string;

  template?: string;

  templateData?: Record<string, any>;
  event?: string;
}

@Injectable()
export class EmailChannel {
  private readonly logger = new Logger(
    EmailChannel.name,
  );

  private readonly transporter;

  private readonly from: string;

  constructor(
    private readonly config: ConfigService,
    private readonly templateService: TemplateService,
    private readonly eventService: NotificationEventService,
  ) {
    this.from = this.config.get<string>(
      'EMAIL_FROM',
      'noreply@schoolos.com',
    );

    this.transporter = nodemailer.createTransport({
      host: this.config.get<string>(
        'SMTP_HOST',
        'smtp.zoho.in',
      ),

      port: Number(
        this.config.get<string>('SMTP_PORT', '587'),
      ),

      secure:
        this.config.get<string>('SMTP_SECURE') ===
        'true',

      auth: {
        user: this.config.get<string>('SMTP_USER'),
        pass: this.config.get<string>('SMTP_PASS'),
      },

      tls: {
        minVersion: this.config.get<string>(
          'SMTP_TLS_MIN_VERSION',
          'TLSv1.2',
        ) as 'TLSv1.2',
      },
    });
  }

  async send(
    payload: EmailPayload,
  ): Promise<boolean> {
    try {
      // Validation

      if (!payload.to) {
        this.logger.error(
          'Missing recipient email',
        );

        return false;
      }


if (
  !payload.body &&
  !payload.template &&
  !payload.event &&
  !payload.html
) {
  this.logger.error(
    'Missing email content',
  );

  return false;
}





      // SMTP validation

      const smtpUser =
        this.config.get<string>('SMTP_USER');

      const smtpPass =
        this.config.get<string>('SMTP_PASS');

      if (!smtpUser || !smtpPass) {
        this.logger.warn(
          `[EMAIL STUB] Missing SMTP credentials`,
        );

        this.logger.warn(
          `[EMAIL STUB] To: ${payload.to} | Subject: ${payload.subject}`,
        );

        return true;
      }

      // Verify SMTP

      await this.transporter.verify();

      // Send mail

      const info = await this.transporter.sendMail({
        from: this.from,

        to: payload.to,

        subject:
          payload.subject ||
          'SchoolOS Notification',

        text: payload.body,


html:
  payload.html ??
  (
    payload.event
      ? this.templateService.render(
          this.eventService.resolveTemplate(
            payload.event as never,
          ),
          payload.templateData || {},
        )

      : payload.template
        ? this.templateService.render(
            payload.template,
            payload.templateData || {},
          )

        : this.templateService.render(
            'announcement',
            {
              title:
                payload.subject ||
                'SchoolOS Notification',

              body:
                payload.body || '',
            },
          )
  ),
      });

      this.logger.log(
        `Email sent to ${payload.to} | MessageId: ${info.messageId}`,
      );

      return true;
    } catch (err: any) {
      this.logger.error(
        `Email failed to ${payload.to}: ${err.message}`,
      );

      return false;
    }
  }
}
