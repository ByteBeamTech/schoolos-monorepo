import type {
  PricingPlan,
  PricingCalculationResult,
  CalculatePricingDto,
} from '@schoolos/api-contracts/pricing';
import { PerStudentModel } from './models/per-student.model';
import { SubscriptionModel } from './models/subscription.model';
import { HybridModel } from './models/hybrid.model';
import { CustomRatesModel } from './models/custom-rates.model';

/**
 * PricingFactory
 *
 * Resolves the correct pricing model from a PricingPlan.model enum value.
 * If customPerStudentRate or customBaseFee overrides are provided,
 * delegates to CustomRatesModel regardless of base model type.
 *
 * Mirrors GatewayFactory.forTenant() pattern.
 */
export class PricingFactory {
  static calculate({
    plan,
    studentCount,
    taxPercent = 0,
    customPerStudentRate,
    customBaseFee,
  }: {
    plan: PricingPlan;
    studentCount: number;
    taxPercent?: number;
    customPerStudentRate?: number;
    customBaseFee?: number;
  }): PricingCalculationResult {
    const hasCustomRates =
      customPerStudentRate !== undefined || customBaseFee !== undefined;

    // Custom enterprise overrides — wrap any model
    if (hasCustomRates) {
      const model = new CustomRatesModel(plan, { customPerStudentRate, customBaseFee });
      return model.calculate(studentCount, taxPercent);
    }

    // Standard model dispatch using your PricingModel enum
    switch (plan.model) {
      case 'PER_STUDENT': {
        const model = new PerStudentModel(plan);
        return model.calculate(studentCount, taxPercent);
      }

      case 'SUBSCRIPTION': {
        const model = new SubscriptionModel(plan);
        return model.calculate(studentCount, taxPercent);
      }

      case 'HYBRID': {
        const model = new HybridModel(plan);
        return model.calculate(studentCount, taxPercent);
      }

      default:
        throw new Error(`Unknown PricingModel: ${(plan as any).model}`);
    }
  }
}