import { Injectable } from '@nestjs/common';

import { CreatePricingPlanDto } from '../dto/create-pricing-plan.dto';
import { PricingPlanQueryDto } from '../dto/pricing-plan-query.dto';
import { UpdatePricingPlanDto } from '../dto/update-pricing-plan.dto';

import { PricingPlanMapper } from '../mappers/pricing-plan.mapper';
import { PricingPlanRepository } from '../repositories/pricing-plan.repository';
import { PricingPlanValidator } from '../validators/pricing-plan.validator';

@Injectable()
export class PricingPlansService {
  constructor(
    private readonly repository: PricingPlanRepository,
    private readonly validator: PricingPlanValidator,
    private readonly mapper: PricingPlanMapper,
  ) {}

  async create(
    dto: CreatePricingPlanDto,
  ) {
    await this.validator.validateCreate(dto);

    const plan =
      await this.repository.create(dto);

    return this.mapper.toResponse(plan);
  }

  async findAll(
    query: PricingPlanQueryDto,
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
    const plan =
      await this.validator.ensureExists(id);

    return this.mapper.toResponse(plan);
  }

  async update(
    id: string,
    dto: UpdatePricingPlanDto,
  ) {
    await this.validator.validateUpdate(
      id,
      dto,
    );

    const plan =
      await this.repository.update(
        id,
        dto,
      );

    return this.mapper.toResponse(plan);
  }

  async archive(
    id: string,
  ) {
    await this.validator.ensureCanArchive(
      id,
    );

    const plan =
      await this.repository.archive(id);

    return this.mapper.toResponse(plan);
  }

  async restore(
    id: string,
  ) {
    await this.validator.ensureCanRestore(
      id,
    );

    const plan =
      await this.repository.restore(id);

    return this.mapper.toResponse(plan);
  }

  async publish(
    id: string,
  ) {
    await this.validator.ensureCanPublish(
      id,
    );

    const plan =
      await this.repository.publish(id);

    return this.mapper.toResponse(plan);
  }

  async findPublic() {
    const plans =
      await this.repository.findPublic();

    return this.mapper.toResponses(
      plans,
    );
  }

  async findRecommended() {
    const plans =
      await this.repository.findRecommended();

    return this.mapper.toResponses(
      plans,
    );
  }
}
