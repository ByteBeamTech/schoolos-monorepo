import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { PricingAddon } from '@prisma/client';

import { CreatePricingAddonDto } from '../dto/create-pricing-addon.dto';
import { UpdatePricingAddonDto } from '../dto/update-pricing-addon.dto';
import { PricingAddonRepository } from '../repositories/pricing-addon.repository';

@Injectable()
export class PricingAddonValidator {
  constructor(
    private readonly repository: PricingAddonRepository,
  ) {}

  async ensureExists(
    id: string,
  ): Promise<PricingAddon> {
    const addon =
      await this.repository.findById(id);

    if (!addon) {
      throw new NotFoundException(
        'Pricing addon not found.',
      );
    }

    return addon;
  }

  async ensureUniqueCode(
    code: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing =
      await this.repository.findByCode(code);

    if (!existing) {
      return;
    }

    if (
      ignoreId &&
      existing.id === ignoreId
    ) {
      return;
    }

    throw new ConflictException(
      `Pricing addon code '${code}' already exists.`,
    );
  }

  async ensureCanArchive(
    id: string,
  ): Promise<PricingAddon> {
    const addon =
      await this.ensureExists(id);

    if (!addon.isActive) {
      throw new BadRequestException(
        'Pricing addon is already archived.',
      );
    }

    return addon;
  }

  async ensureCanRestore(
    id: string,
  ): Promise<PricingAddon> {
    const addon =
      await this.ensureExists(id);

    if (
      addon.deletedAt === null
    ) {
      throw new BadRequestException(
        'Pricing addon is already active.',
      );
    }

    return addon;
  }

  async validateCreate(
    dto: CreatePricingAddonDto,
  ): Promise<void> {
    await this.ensureUniqueCode(
      dto.code,
    );

    if (dto.amount <= 0) {
      throw new BadRequestException(
        'Amount must be greater than zero.',
      );
    }
  }

  async validateUpdate(
    id: string,
    dto: UpdatePricingAddonDto,
  ): Promise<PricingAddon> {
    const addon =
      await this.ensureExists(id);

    if (dto.code) {
      await this.ensureUniqueCode(
        dto.code,
        id,
      );
    }

    if (
      dto.amount !== undefined &&
      dto.amount <= 0
    ) {
      throw new BadRequestException(
        'Amount must be greater than zero.',
      );
    }

    return addon;
  }
}
