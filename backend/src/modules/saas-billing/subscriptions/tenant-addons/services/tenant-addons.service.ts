import { Injectable } from '@nestjs/common';

import { CreateTenantAddonDto } from '../dto/create-tenant-addon.dto';
import { TenantAddonQueryDto } from '../dto/tenant-addon-query.dto';
import { UpdateTenantAddonDto } from '../dto/update-tenant-addon.dto';

import { TenantAddonMapper } from '../mappers/tenant-addon.mapper';
import { TenantAddonRepository } from '../repositories/tenant-addon.repository';
import { TenantAddonValidator } from '../validators/tenant-addon.validator';

@Injectable()
export class TenantAddonsService {
  constructor(
    private readonly repository: TenantAddonRepository,
    private readonly validator: TenantAddonValidator,
    private readonly mapper: TenantAddonMapper,
  ) {}

  async create(
    tenantId: string,
    dto: CreateTenantAddonDto,
  ) {
    await this.validator.validateCreate(
      tenantId,
      dto,
    );

    const addon =
      await this.repository.create(
        tenantId,
        dto,
      );

    return this.mapper.toResponse(
      addon,
    );
  }

  async findAll(
    query: TenantAddonQueryDto,
  ) {
    const result =
      await this.repository.findAll(
        query,
      );

    return this.mapper.toPagedResponse(
      result,
    );
  }

  async findOne(
    id: string,
  ) {
    const addon =
      await this.validator.ensureExists(
        id,
      );

    return this.mapper.toResponse(
      addon,
    );
  }

  async update(
    id: string,
    dto: UpdateTenantAddonDto,
  ) {
    await this.validator.validateUpdate(
      id,
      dto,
    );

    const addon =
      await this.repository.update(
        id,
        dto,
      );

    return this.mapper.toResponse(
      addon,
    );
  }

  async activate(
    id: string,
  ) {
    await this.validator.ensureCanActivate(
      id,
    );

    const addon =
      await this.repository.activate(
        id,
      );

    return this.mapper.toResponse(
      addon,
    );
  }

  async deactivate(
    id: string,
  ) {
    await this.validator.ensureCanDeactivate(
      id,
    );

    const addon =
      await this.repository.deactivate(
        id,
      );

    return this.mapper.toResponse(
      addon,
    );
  }

  async archive(
    id: string,
  ) {
    await this.validator.ensureCanArchive(
      id,
    );

    const addon =
      await this.repository.archive(
        id,
      );

    return this.mapper.toResponse(
      addon,
    );
  }

  async bySubscription(
    subscriptionId: string,
  ) {
    const addons =
      await this.repository.findBySubscription(
        subscriptionId,
      );

    return this.mapper.toResponses(
      addons,
    );
  }
}
