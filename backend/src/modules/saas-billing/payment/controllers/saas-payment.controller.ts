// modules/saas-billing/payment/controllers/saas-payment.controller.ts

import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

import { JwtGuard }           from '../../../../core/auth/guards/jwt.guard';
import { JwtSuperadminGuard } from '../../../../core/auth/guards/jwt-superadmin.guard';
import { SuperadminRoute }    from '../../../../core/auth/decorators/superadmin-route.decorator';
import { RolesGuard }         from '../../../../core/roles/roles.guard';
import { Roles }              from '../../../../core/roles/roles.decorator';
import { CurrentUser }        from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser }  from '../../../../core/auth/guards/jwt.strategy';

import { SaasPaymentService }       from '../services/saas-payment.service';
import { RecordOfflinePaymentDto }  from '../dto/record-offline-payment.dto';

// PR-3 fix: the gateway webhook used to live here too (POST
// saas/payments/webhook/razorpay), which broke in practice -- TenantMiddleware
// is global and requires an x-tenant-id header on every route except ones
// matching the pre-existing 'webhooks/(.*)' exclusion pattern in
// app.module.ts. Razorpay obviously never sends that header. Moved the
// webhook to its own controller (saas-webhook.controller.ts) under the
// `webhooks/` prefix so it rides the exclusion that already exists, instead
// of inventing a new one. This controller now only holds the two
// tenant/superadmin-authenticated endpoints, which correctly DO go through
// TenantMiddleware.

@ApiTags('saas-billing-payments')
@Controller('saas')
export class SaasPaymentController {
  constructor(private readonly payments: SaasPaymentService) {}

  // ─── Tenant-initiated: create a gateway order for one of their own
  //     outstanding invoices. Tenant-ownership is enforced in the service,
  //     not just here -- defense in depth. ────────────────────────────────────

  @Post('invoices/:id/pay')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('SCHOOL_ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create a payment order for an outstanding SaaS invoice' })
  createOrder(@Param('id') invoiceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.payments.createOrder(invoiceId, user.tenantId);
  }

  // ─── Superadmin: record an offline/manual payment (bank transfer, cheque)
  //     after Finance has independently verified it against a bank
  //     statement. See RecordOfflinePaymentDto and the commercial
  //     architecture discussion -- never auto-trust a tenant's payment claim,
  //     this endpoint IS the trust boundary, gated to SUPER_ADMIN. ──────────

  @Post('invoices/:id/offline-payment')
  @ApiBearerAuth('access-token')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Record a manually-verified offline payment against a SaaS invoice' })
  recordOfflinePayment(
    @Param('id') invoiceId: string,
    @Body() dto: RecordOfflinePaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.payments.recordOfflinePayment(invoiceId, dto, user.id);
  }
}
