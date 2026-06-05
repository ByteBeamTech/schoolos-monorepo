import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/authenticated-user.interface';

@ApiTags('Superadmin Coupons')
@Controller('superadmin')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get('coupons')
  @ApiOperation({ summary: 'List all coupons' })
  listCoupons() {
    return this.couponsService.list();
  }

  @Post('coupons')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new promo coupon' })
  createCoupon(@Body() body: any, @CurrentUser() u: AuthenticatedUser) {
    return this.couponsService.create(body, u.id);
  }

  @Delete('coupons/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a coupon' })
  deleteCoupon(@Param('id') id: string) {
    return this.couponsService.remove(id);
  }
}
