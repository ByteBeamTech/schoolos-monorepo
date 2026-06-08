import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';

import {
  ApiOperation,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';


import { SuperadminRoute } from '../../core/auth/decorators/superadmin-route.decorator';
import { CouponsService } from './coupons.service';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../core/auth/interfaces/authenticated-user.interface';

import { JwtSuperadminGuard } from '../../core/auth/guards/jwt-superadmin.guard';
import { RolesGuard } from '../../core/roles/roles.guard';
import { Roles } from '../../core/roles/roles.decorator';
@SuperadminRoute()
@ApiTags('Superadmin Coupons')
@ApiBearerAuth('access-token')
@UseGuards(JwtSuperadminGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('superadmin')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get('coupons')
  @ApiOperation({ summary: 'List all coupons' })
  listCoupons() {
	  console.log('🔥 COUPONS CONTROLLER HIT');
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
