import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InventoryService }    from '../services/inventory.service';
import { CreateAssetDto, CreateStockItemDto, AddMaintenanceLogDto } from '../dto/inventory.dto';
import { JwtGuard }            from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }          from '../../../core/roles/roles.guard';
import { Roles }               from '../../../core/roles/roles.decorator';
import { CurrentUser }         from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser }   from '../../../core/auth/guards/jwt.strategy';

@ApiTags('inventory')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly svc: InventoryService) {}

  @Get('stats')         stats(@CurrentUser() u: AuthenticatedUser)   { return this.svc.stats(u.tenantId); }
  @Get('stock/low')     lowStock(@CurrentUser() u: AuthenticatedUser){ return this.svc.getLowStock(u.tenantId); }

  @Get('assets')
  @ApiQuery({ name: 'category', required: false })
  listAssets(@CurrentUser() u: AuthenticatedUser, @Query('category') cat?: string) {
    return this.svc.listAssets(u.tenantId, cat);
  }

  @Post('assets')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  createAsset(@Body() dto: CreateAssetDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.createAsset(u.tenantId, dto);
  }

  @Post('assets/:id/maintenance')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'STAFF')
  addLog(@Param('id') id: string, @Body() dto: AddMaintenanceLogDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.addMaintenanceLog(u.tenantId, id, dto);
  }

  @Get('stock')
  listStock(@CurrentUser() u: AuthenticatedUser) { return this.svc.listStock(u.tenantId); }

  @Post('stock')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  createStock(@Body() dto: CreateStockItemDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.createStockItem(u.tenantId, dto);
  }

  @Patch('stock/:id/quantity')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'STAFF')
  updateQty(@Param('id') id: string, @Body('quantity') qty: number, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.updateStockQuantity(u.tenantId, id, qty);
  }
}
