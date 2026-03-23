import { Controller, Post, Get, Body, Req, Headers } from '@nestjs/common';
import { LeadService } from '../services/lead.service';

@Controller('crm')
export class LeadController {
  constructor(private readonly leadService: LeadService) {}

  @Get('leads')
  async findAll(@Headers('x-tenant-id') tenantId: string) {
    return this.leadService.findAllLeads(tenantId || 'primary');
  }

  @Post('leads')
  async create(@Body() body: any, @Req() req: any, @Headers('x-tenant-id') tenantId: string) {
    // Priority: Header > User Session > Default
    const tId = tenantId || req.user?.tenantId || 'primary';
    const bId = req.user?.branchId || 'primary';
    return this.leadService.createLead(body, tId, bId);
  }
}
