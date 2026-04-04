import { Controller, Get, Post, Param, Body, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PaymentService }    from '../services/payment.service';
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
  constructor(private readonly service: PaymentService) {}

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
  @ApiOperation({ summary: 'Get payment history for invoice' })
  getHistory(@Param('invoiceId') invoiceId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getPaymentHistory(user.tenantId, invoiceId);
  }
}
