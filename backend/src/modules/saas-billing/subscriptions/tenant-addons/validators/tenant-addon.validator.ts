import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  AddonStatus,
  TenantAddon,
} from '@prisma/client';

import { CreateTenantAddonDto } from '../dto/create-tenant-addon.dto';
import { UpdateTenantAddonDto } from '../dto/update-tenant-addon.dto';
import { TenantAddonRepository } from '../repositories/tenant-addon.repository';

@Injectable()
export class TenantAddonValidator {
  constructor(
    private readonly repository: TenantAddonRepository,
  ) {}

  async ensureExists(
    id: string,
  ): Promise<TenantAddon> {
    const addon =
      await this.repository.findById(id);

    if (!addon) {
      throw new NotFoundException(
        'Tenant addon not found.',
      );
    }

    return addon;
  }

  async ensureUnique(
    tenantId: string,
    subscriptionId: string,
    addonId: string,
  ): Promise<void> {
    const exists =
      await this.repository.exists(
        tenantId,
        subscriptionId,
        addonId,
      );

    if (exists) {
      throw new ConflictException(
        'Addon already assigned to this subscription.',
      );
    }
  }

  async ensureCanActivate(
    id: string,
  ): Promise<TenantAddon> {
    const addon =
      await this.ensureExists(id);

    if (
      addon.status ===
      AddonStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Addon already active.',
      );
    }

    return addon;
  }

async ensureCanDeactivate(
  id: string,
): Promise<TenantAddon> {
  const addon =
    await this.ensureExists(id);

  if (
    addon.status ===
    AddonStatus.CANCELLED
  ) {
    throw new BadRequestException(
      'Addon is already cancelled.',
    );
  }

  if (
    addon.status ===
    AddonStatus.EXPIRED
  ) {
    throw new BadRequestException(
      'Expired addon cannot be cancelled.',
    );
  }

  return addon;
}
  async validateCreate(
    tenantId: string,
    dto: CreateTenantAddonDto,
  ): Promise<void> {
    await this.ensureUnique(
      tenantId,
      dto.subscriptionId,
      dto.addonId,
    );

    if (dto.quantity < 1) {
      throw new BadRequestException(
        'Quantity must be greater than zero.',
      );
    }
  }

  async validateUpdate(
    id: string,
    dto: UpdateTenantAddonDto,
  ): Promise<TenantAddon> {
    const addon =
      await this.ensureExists(id);

    if (
      dto.quantity !== undefined &&
      dto.quantity < 1
    ) {
      throw new BadRequestException(
        'Quantity must be greater than zero.',
      );
    }

    return addon;
  }

  async ensureCanArchive(
    id: string,
  ): Promise<TenantAddon> {
    return this.ensureExists(id);
  }
}
