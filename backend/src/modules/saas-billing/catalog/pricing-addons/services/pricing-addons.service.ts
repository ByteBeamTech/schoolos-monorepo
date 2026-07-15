import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CreatePricingAddonDto } from '../dto/create-pricing-addon.dto';
import { PricingAddonQueryDto } from '../dto/pricing-addon-query.dto';
import { UpdatePricingAddonDto } from '../dto/update-pricing-addon.dto';

import { PricingAddonMapper } from '../mappers/pricing-addon.mapper';
import { PricingAddonRepository } from '../repositories/pricing-addon.repository';
import { PricingAddonValidator } from '../validators/pricing-addon.validator';

@Injectable()
export class PricingAddonsService {
  constructor(
    private readonly repository: PricingAddonRepository,
    private readonly validator: PricingAddonValidator,
    private readonly mapper: PricingAddonMapper,
  ) {}

  async create(
    dto: CreatePricingAddonDto,
  ) {
    await this.validator.validateCreate(dto);

    const addon =
      await this.repository.create(dto);

    return this.mapper.toResponse(addon);
  }

  async findAll(
    query: PricingAddonQueryDto,
  ) {
    const result =
      await this.repository.findAll(query);

    return this.mapper.toPagedResponse(
      result,
    );
  }

  async findOne(
    id: string,
  ) {
    const addon =
      await this.repository.findById(id);

    if (!addon) {
      throw new NotFoundException(
        'Pricing addon not found.',
      );
    }

    return this.mapper.toResponse(
      addon,
    );
  }

  async update(
    id: string,
    dto: UpdatePricingAddonDto,
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

  async archive(
    id: string,
  ) {
    await this.validator.ensureCanArchive(
      id,
    );

    const addon =
      await this.repository.archive(id);

    return this.mapper.toResponse(
      addon,
    );
  }

  async restore(
    id: string,
  ) {
    await this.validator.ensureCanRestore(
      id,
    );

    const addon =
      await this.repository.restore(id);

    return this.mapper.toResponse(
      addon,
    );
  }

  async active() {
    const addons =
      await this.repository.findActive();

    return this.mapper.toResponses(
      addons,
    );
  }
}
