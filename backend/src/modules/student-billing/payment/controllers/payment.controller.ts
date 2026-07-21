import { Controller, Get, Post, Param, Body, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentService }    from '../services/payment.service';
import { StudentBillingAccessService } from '../../access/student-billing-access.service';
import { InitiatePaymentDto, VerifyRazorpayPaymentDto, RecordOfflinePaymentDto } from '../../dto/billing.dto';
import { JwtGuard }          from '../../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../../core/roles/roles.guard';
import { Roles }             from '../../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../../core/auth/guards/jwt.strategy';

@ApiTags('payments')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('billing/payments')
export class PaymentController {
  constructor(
    private readonly service: PaymentService,
    private readonly access:  StudentBillingAccessService,
  ) {}

  @Post('initiate')
  @Roles('SCHOOL_ADMIN', 'ACCOUNTANT', 'PARENT')
  @ApiOperation({ summary: 'Initiate Razorpay payment' })
  initiate(@Body() dto: InitiatePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.initiateRazorpay(user.tenantId, dto, user.id);
  }

  @Post('verify-razorpay')
  @Roles('SCHOOL_ADMIN', 'ACCOUNTANT', 'PARENT')
  @ApiOperation({ summary: 'Verify Razorpay payment' })
  verify(@Body() dto: VerifyRazorpayPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.verifyRazorpay(user.tenantId, dto, user.id);
  }

  @Post('record-offline')
  @Roles('SCHOOL_ADMIN', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Record offline payment (cash/cheque/NEFT)' })
  recordOffline(@Body() dto: RecordOfflinePaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.recordOffline(user.tenantId, dto, user.id);
  }

  @Get('invoice/:invoiceId')
  // FEE-0: was unguarded (AUTH-041 violation -- any authenticated user could
  // read any invoice's payment history, incl. payer contact details, across
  // branches). Staff-only + branch-scoped; PARENT payment history is deferred
  // to the Student Financial Account projection (FEE-4 / AUTH-021) by
  // explicit decision -- note payment records also carry staff-relevant
  // gateway metadata that ADR-FEE-001 §7 classifies away from parents.
  @Roles('SUPER_ADMIN', 'SCHOOL_OWNER', 'SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Get payment history for invoice' })
  getHistory(@Param('invoiceId') invoiceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getPaymentHistory(
      user.tenantId,
      invoiceId,
      this.access.resolveAuthorizedBranchIds(user),
    );
  }
}
