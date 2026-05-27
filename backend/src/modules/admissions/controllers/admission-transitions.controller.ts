import { Body, Controller, Get, Param, Post, Request } from '@nestjs/common';
import { AdmissionStateMachineService, AdmissionStatus } from '../services/admission-state-machine.service';
import { PrismaService } from '@infra/database/prisma.service';

import { UseGuards } from '@nestjs/common';
import { JwtGuard } from '../../../core/auth/guards/jwt.guard';
import { RolesGuard } from '../../../core/roles/roles.guard';
import { Roles } from '../../../core/roles/roles.decorator';

@Controller('admissions')
@UseGuards(JwtGuard, RolesGuard)
@Roles('SCHOOL_ADMIN', 'PRINCIPAL')

export class AdmissionTransitionsController {
  private readonly sm: AdmissionStateMachineService;

  constructor(private readonly prisma: PrismaService) {
    this.sm = new AdmissionStateMachineService(prisma);
  }

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

  @Get('funnel')
  async funnel(@Request() req: any) {
    const branchId = req.query.branchId as string | undefined;
    return this.sm.getFunnelAnalytics(req.user.tenantId, branchId);
  }
}
