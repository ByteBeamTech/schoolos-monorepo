import { Module }          from '@nestjs/common';
import { LibraryService }  from './services/library.service';
import { BorrowerResolverService } from './services/borrower-resolver.service';
import { BookCopyService } from './services/book-copy.service';
import { ReservationService } from './services/reservation.service';
import { InventoryAuditService } from './services/inventory-audit.service';
import { LibraryChargeRequestService } from './services/charge-request.service';
import { LibraryController } from './controllers/library.controller';
import { PrismaModule }    from '../../infra/database/prisma.module';
import { ComplianceModule } from '../../core/compliance/compliance.module';
import { RolesModule }     from '../../core/roles/roles.module';

@Module({
  imports:     [PrismaModule, ComplianceModule, RolesModule],
  providers:   [
    LibraryService, BorrowerResolverService, BookCopyService,
    ReservationService, InventoryAuditService, LibraryChargeRequestService,
  ],
  controllers: [LibraryController],
  exports:     [LibraryService, BorrowerResolverService],
})
export class LibraryModule {}
