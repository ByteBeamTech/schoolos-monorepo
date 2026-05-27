import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
} from '@nestjs/common';

import { LeadService } from '../services/lead.service';

import { JwtGuard } from '../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles } from '../../../core/roles/roles.decorator';

import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/interfaces/authenticated-user.interface';

@Controller('crm')
@UseGuards(JwtGuard, RolesGuard)
@Roles('SCHOOL_ADMIN', 'PRINCIPAL')
export class LeadController {
  constructor(
    private readonly leadService: LeadService,
  ) {}

  @Get('leads')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadService.findAllLeads(
      user.tenantId,
    );
  }

  @Post('leads')
  async create(
    @Body() body: any,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.leadService.createLead(
      body,
      user.tenantId,
      user.branchId,
    );
  }
}
