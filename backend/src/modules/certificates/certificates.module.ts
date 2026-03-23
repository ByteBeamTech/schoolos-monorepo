import { Module }               from '@nestjs/common';
import { CertificatesService }  from './services/certificates.service';
import { CertificatesController } from './controllers/certificates.controller';
import { PrismaModule }         from '../../infra/database/prisma.module';
import { ComplianceModule }     from '../../core/compliance/compliance.module';
import { RolesModule }          from '../../core/roles/roles.module';
import { StorageModule }        from '../../infra/storage/storage.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule, StorageModule],
  providers:   [CertificatesService],
  controllers: [CertificatesController],
  exports:     [CertificatesService],
})
export class CertificatesModule {}
