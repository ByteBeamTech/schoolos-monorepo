// backend/src/modules/saas-billing/saas-billing.controller.ts
// NEW FILE — create this file, then register it in saas-billing.module.ts
//
// After creating this file, open saas-billing.module.ts and add:
//   import { SaasBillingController } from './saas-billing.controller';
//   controllers: [SaasBillingController],
//
// The frontend billing page calls GET /saas/invoices?limit=50
// This was a 404 — no controller existed anywhere.

import {
  Controller, Get, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtSuperadminGuard } from '../../core/auth/guards/jwt-superadmin.guard';
import { RolesGuard }         from '../../core/roles/roles.guard';
import { Roles }              from '../../core/roles/roles.decorator';
import { PrismaService }      from '../../infra/database/prisma.service';

@ApiTags('saas-billing')
@ApiBearerAuth('access-token')
@UseGuards(JwtSuperadminGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('saas')
export class SaasBillingController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('invoices')
  @ApiOperation({ summary: 'List all SaaS invoices across all tenants' })
  @ApiQuery({ name: 'limit',    required: false })
  @ApiQuery({ name: 'page',     required: false })
  @ApiQuery({ name: 'status',   required: false })
  @ApiQuery({ name: 'tenantId', required: false })
  async listInvoices(
    @Query('limit')    limit?:    string,
    @Query('page')     page?:     string,
    @Query('status')   status?:   string,
    @Query('tenantId') tenantId?: string,
  ) {
    const take = Math.min(parseInt(limit ?? '50'), 200);
    const skip = (parseInt(page ?? '1') - 1) * take;

    const where: any = {};
    if (status)   where.status   = status;
    if (tenantId) where.subscription = { tenantId };

    const [data, total] = await Promise.all([
      this.prisma.saasInvoice.findMany({
        where,
        include: {
          subscription: {
            include: {
              tenant: { select: { id: true, name: true, slug: true } },
              plan:   { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.saasInvoice.count({ where }),
    ]);

    return { data, total, page: parseInt(page ?? '1'), limit: take };
  }
}
