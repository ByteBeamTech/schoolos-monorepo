import { Injectable, Logger } from '@nestjs/common';
import { announcementTemplate } from './announcement.template';
import { otpTemplate } from './otp.template';
import { feeReminderTemplate } from './fee-reminder.template';


export type TemplateKey =
  | 'announcement'
  | 'fee-reminder'
  | 'otp';



@Injectable()
export class TemplateService {
  private readonly logger = new Logger(
    TemplateService.name,
  );

  private readonly templates = {
    announcement: announcementTemplate,
    otp: otpTemplate,
    'fee-reminder': feeReminderTemplate,
  };

  render(
    template: string,
    data: Record<string, any>,
  ): string {
    try {
      const renderer =
        this.templates[
          template as TemplateKey
        ];

      if (!renderer) {
        throw new Error(
          `Template not found: ${template}`,
        );
      }

      return renderer(data as never);
    } catch (err: any) {
      this.logger.error(
        `Template rendering failed: ${err.message}`,
      );

      throw err;
    }
  }
}
