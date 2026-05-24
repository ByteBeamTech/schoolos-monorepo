// /apps/schoolos/backend/src/modules/admissions/controllers/admissions.controller.ts

import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AdmissionsService } from '../services/admissions.service';

// 🔐 AUTH & ROLES CANONICAL SHORTCUTS
import { JwtGuard } from '@core/auth/guards/jwt.guard'; 
import { RolesGuard } from '@core/roles/roles.guard';    
import { Roles } from '@core/roles/roles.decorator';  
import { CurrentUser } from '@core/auth/decorators/current-user.decorator'; // 🟢 FIXED: Swapped to exact physical filename
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface'; 

import { AllocateSeatDto, FinalizeEnrollmentDto } from '../dto/admissions.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('Institutional Admissions Gateway')
@ApiBearerAuth()
@Controller('admissions')
@UseGuards(JwtGuard, RolesGuard)
export class AdmissionsController {
  constructor(private readonly service: AdmissionsService) {}

  @Post(':id/allocate-seat')
  @Roles('ADMIN', 'REGISTRAR')
  @ApiOperation({ summary: 'Acquire Pessimistic Section Seat Allocation Lock' })
  async allocateSeat(
    @Param('id') id: string, 
    @Body() dto: AllocateSeatDto, 
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.allocateSeat(user.tenantId, user.branchId!, id, dto.sectionId, user.id);
  }

  @Post(':id/finalize-enrollment')
  @Roles('ADMIN', 'REGISTRAR')
  @ApiOperation({ summary: 'Commit Atomic Relational Student Enrollment Handshake' })
  async finalize(
    @Param('id') id: string,
    @Body() dto: FinalizeEnrollmentDto, 
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.finalizeEnrollment(user.tenantId, user.branchId!, id, dto.rollNumber, user.id);
  }
}
