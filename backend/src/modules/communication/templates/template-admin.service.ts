import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { PrismaService }
from '@infra/database/prisma.service';

import { CreateTemplateDto }
from './dto/create-template.dto';

import { UpdateTemplateDto }
from './dto/update-template.dto';






@Injectable()
export class TemplateAdminService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async list(tenantId: string) {
    return this.prisma.communicationTemplate.findMany({
      where: { tenantId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async create(
  tenantId: string,
  dto: CreateTemplateDto,
) {
  try {
    return await this.prisma.communicationTemplate.create({
      data: {
        tenantId,
        ...dto,
      },
    });
  } catch (error) {

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        `Template already exists for ${dto.eventType} / ${dto.channel} / ${dto.language ?? 'ENGLISH'}`,
      );
    }

    throw error;
  }
}




  async update(
    tenantId: string,
    id: string,
    dto: UpdateTemplateDto,
  ) {
    const template =
      await this.prisma.communicationTemplate.findFirst({
        where: {
          id,
          tenantId,
        },
      });

    if (!template) {
      throw new NotFoundException(
        'Template not found',
      );
    }
try {
  return await this.prisma.communicationTemplate.update({
    where: { id },
    data: dto,
  });
} catch (error) {

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new ConflictException(
      'Another template already exists with the same tenant/event/channel/language combination',
    );
  }

  throw error;
}
  }











  async remove(
    tenantId: string,
    id: string,
  ) {
    const template =
      await this.prisma.communicationTemplate.findFirst({
        where: {
          id,
          tenantId,
        },
      });

    if (!template) {
      throw new NotFoundException(
        'Template not found',
      );
    }

    await this.prisma.communicationTemplate.delete({
      where: { id },
    });

    return {
      deleted: true,
    };
  }
}
