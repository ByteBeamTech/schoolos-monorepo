import { BadRequestException, Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { AdmissionStateMachineService, AdmissionStatus } from '../services/admission-state-machine.service';

import { UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles } from '../../../core/roles/roles.decorator';

@Controller('admissions')
@UseGuards(JwtGuard, RolesGuard)
@Roles('SCHOOL_ADMIN', 'PRINCIPAL')

export class AdmissionTransitionsController {
  constructor(private readonly sm: AdmissionStateMachineService) {}

  @Post(':id/transition')
  async transition(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: {
      toStatus: AdmissionStatus;
      note?: string;
      payload?: Record<string, unknown>;
    },
  ) {
    return this.sm.transition(id, req.user.tenantId, body.toStatus, {
      actorId: req.user.id,
      note: body.note,
      payload: body.payload,
    });
  }

  @Post(':id/convert')
  async convert(
    @Param('id') id: string,
    @Request() req: any,
    @Body() body: { sectionId: string; rollNumber: string },
  ) {
    if (!body.sectionId || !body.rollNumber) {
      throw new BadRequestException('sectionId and rollNumber are required.');
    }
    return this.sm.convertToStudent(
      id,
      req.user.tenantId,
      req.user.branchId,
      body.sectionId,
      body.rollNumber,
      req.user.id,
    );
  }

  @Get('funnel')
  async funnel(@Request() req: any) {
    const branchId = req.query.branchId as string | undefined;
    return this.sm.getFunnelAnalytics(req.user.tenantId, branchId);
  }
}
