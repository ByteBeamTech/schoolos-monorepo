import { Module }            from '@nestjs/common';
import { InventoryService }  from './services/inventory.service';
import { InventoryController } from './controllers/inventory.controller';
import { PrismaModule }      from '../../infra/database/prisma.module';
import { RolesModule }       from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, RolesModule],
  providers:   [InventoryService],
  controllers: [InventoryController],
  exports:     [InventoryService],
})
export class InventoryModule {}
