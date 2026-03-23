import { Module } from '@nestjs/common';
import { LeadController } from './controllers/lead.controller';
import { LeadService } from './services/lead.service';

@Module({
  controllers: [LeadController],
  providers: [LeadService],
  exports: [LeadService],
})
export class CrmModule {}
