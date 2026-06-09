import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface';
import { FollowUpService } from '../services/follow-up.service';
import {
  CreateFollowUpDto,
  ListFollowUpsQueryDto,
  UpdateFollowUpDto,
} from '../dto/follow-up.dto';

@Controller('crm')
@UseGuards(JwtGuard, RolesGuard)
export class FollowUpController {
  constructor(private readonly service: FollowUpService) {}

  @Get('leads/:leadId/follow-ups')
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN', 'PRINCIPAL')
  listByLead(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leadId') leadId: string,
  ) {
    return this.service.listByLead(user, leadId);
  }

  @Post('leads/:leadId/follow-ups')
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN', 'PRINCIPAL')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('leadId') leadId: string,
    @Body() dto: CreateFollowUpDto,
  ) {
    return this.service.create(user, leadId, dto);
  }

  @Get('follow-ups')
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN', 'PRINCIPAL')
  listMine(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListFollowUpsQueryDto,
  ) {
    return this.service.listMine(user, query);
  }

  @Patch('follow-ups/:id')
  @Roles('RECEPTIONIST', 'SCHOOL_ADMIN', 'PRINCIPAL')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateFollowUpDto,
  ) {
    return this.service.update(user, id, dto);
  }
}
