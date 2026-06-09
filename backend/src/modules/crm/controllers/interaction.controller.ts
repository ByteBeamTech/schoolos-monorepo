import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { InteractionService } from '../services/interaction.service';
import { CreateInteractionDto } from '../dto/interaction.dto';

@Controller('crm/leads/:leadId/interactions')
@UseGuards(JwtGuard, RolesGuard)
export class InteractionController {
  constructor(private readonly service: InteractionService) {}

  @Get()
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN', 'PRINCIPAL')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leadId') leadId: string,
  ) {
    return this.service.listByLead(user, leadId);
  }

  @Post()
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN', 'PRINCIPAL')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leadId') leadId: string,
    @Body() dto: CreateInteractionDto,
  ) {
    return this.service.create(user, leadId, dto);
  }
}
