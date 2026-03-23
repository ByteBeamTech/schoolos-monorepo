import { Module }               from '@nestjs/common';
import { TenantAdminService }   from './services/tenant-admin.service';
import { TenantAdminController }from './tenant-admin.controller';

@Module({
  providers:   [TenantAdminService],
  controllers: [TenantAdminController],
  exports:     [TenantAdminService],
})
export class TenantsAdminModule {}
