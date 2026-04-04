import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { CreateAssetDto, CreateStockItemDto, AddMaintenanceLogDto } from '../dto/inventory.dto';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(tenantId: string) {
    const [assets, stock] = await Promise.all([
      this.prisma.asset.count({ where: { tenantId, isActive: true } }),
      this.prisma.stockItem.count({ where: { tenantId } }),
    ]);
    return { assets, stockItems: stock };
  }

  // Assets
  async listAssets(tenantId: string, category?: string) {
    return this.prisma.asset.findMany({
      where:   { tenantId, isActive: true, ...(category && { category }) },
      include: { maintenanceLogs: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { name: 'asc' },
    });
  }

  async createAsset(tenantId: string, dto: CreateAssetDto) {
    return this.prisma.asset.create({
      data: {
        tenantId,
        name:        dto.name,
        category:    dto.category    ?? null,
        description: dto.description ?? null,
        purchaseDate: dto.purchaseDate ? new Date(dto.purchaseDate) : null,
        cost:         dto.purchasePrice ?? null,
      } as any,
    });
  }

  async addMaintenanceLog(tenantId: string, assetId: string, dto: AddMaintenanceLogDto) {
    const asset = await this.prisma.asset.findFirst({ where: { id: assetId, tenantId } });
    if (!asset) throw new NotFoundException('Asset not found');
    return this.prisma.maintenanceLog.create({
      data: {
        tenantId,
        assetId,
        issue:  dto.description ?? 'Maintenance',  // schema field: issue
        status: 'OPEN',
        cost:   dto.cost ?? null,
        notes:  dto.performedBy ? `Performed by: ${dto.performedBy}` : null,
      },
    });
  }

  // Stock
  async listStock(tenantId: string) {
    return this.prisma.stockItem.findMany({
      where:   { tenantId },
      orderBy: { name: 'asc' },
    });
  }

  async createStockItem(tenantId: string, dto: CreateStockItemDto) {
    return this.prisma.stockItem.create({
      data: {
        tenantId,
        name:     dto.name,
        category: dto.category ?? null,
        quantity: dto.quantity ?? 0,
      } as any,
    });
  }

  async updateStockQuantity(tenantId: string, id: string, quantity: number) {
    const item = await this.prisma.stockItem.findFirst({ where: { id, tenantId } });
    if (!item) throw new NotFoundException('Stock item not found');
    return this.prisma.stockItem.update({ where: { id }, data: { quantity } });
  }

  async getLowStock(tenantId: string) {
    const items = await this.prisma.stockItem.findMany({ where: { tenantId } });
    return items.filter((i: any) => i.quantity <= i.minQuantity);
  }
}
