import { Module }          from '@nestjs/common';
import { LibraryService }  from './services/library.service';
import { LibraryController } from './controllers/library.controller';
import { PrismaModule }    from '../../infra/database/prisma.module';
import { ComplianceModule } from '../../core/compliance/compliance.module';
import { RolesModule }     from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule],
  providers:   [LibraryService],
  controllers: [LibraryController],
  exports:     [LibraryService],
})
export class LibraryModule {}
