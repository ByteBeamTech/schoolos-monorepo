import * as Handlebars from 'handlebars';
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

// Prisma client se strict types import karein
import {
  NotificationChannel,
  Language,
} from '@prisma/client';

// Aapka sahi mapped alias path
import { PrismaService } from '@infra/database/prisma.service';

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async render(
    tenantId: string,
    eventType: string,
    channel: NotificationChannel,
    data: any,
    // Default value ko Language enum se assign karein
    language: Language = Language.ENGLISH,
  ) {
    const template =
      await this.prisma.communicationTemplate.findFirst({
        where: {
          tenantId,
          eventType,
          channel,
          language, // Ab ye strict enum type match karega
          active: true,
        },
      });

    if (!template) {
      throw new NotFoundException(
        `Template not found for event: ${eventType}, channel: ${channel}, language: ${language}`,
      );
    }

    // Body compile logic
    const compiledBody = Handlebars.compile(template.body);
    const body = compiledBody(data);

    // Subject compile logic
    let subject: string | undefined;
    if (template.subject) {
      subject = Handlebars.compile(template.subject)(data);
    }

    return {
      body,
      subject,
      dltTemplateId: template.dltTemplateId,
      dltPeId: template.dltPeId,
      whatsappTemplateId: template.whatsappTemplateId,
    };
  }
}
