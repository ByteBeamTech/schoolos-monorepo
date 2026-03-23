import {
  Controller, Get, Post, Patch, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtGuard }     from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }   from '../../../core/roles/roles.guard';
import { Roles }        from '../../../core/roles/roles.decorator';
import { CurrentUser }  from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';
import { SupportService }    from '../services/support.service';
import { CreateTicketDto, UpdateTicketDto, AddMessageDto } from '../dto/support.dto';

@ApiTags('support')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('support')
export class SupportController {
  constructor(private readonly svc: SupportService) {}

  // ── School-facing ─────────────────────────────────────────────────────────

  @Post('tickets')
  @ApiOperation({ summary: 'Create support ticket' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.create(u.tenantId, dto, u.id);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List my tickets' })
  @ApiQuery({ name: 'status', required: false })
  list(@CurrentUser() u: AuthenticatedUser, @Query('status') status?: string) {
    return this.svc.listByTenant(u.tenantId, status);
  }

  @Get('tickets/:id')
  @ApiOperation({ summary: 'Get ticket with messages' })
  getOne(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.getById(id, u.tenantId);
  }

  @Post('tickets/:id/messages')
  @ApiOperation({ summary: 'Reply to ticket' })
  addMessage(
    @Param('id') id: string,
    @Body() dto: AddMessageDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.svc.addMessage(id, dto, u.id, u.role, u.tenantId);
  }

  // ── Superadmin ────────────────────────────────────────────────────────────

  @Get('admin/tickets')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'List all tickets (superadmin)' })
  @ApiQuery({ name: 'status',      required: false })
  @ApiQuery({ name: 'priority',    required: false })
  @ApiQuery({ name: 'tenantId',    required: false })
  @ApiQuery({ name: 'assignedTo',  required: false })
  @ApiQuery({ name: 'slaBreached', required: false })
  listAll(
    @Query('status')      status?:      string,
    @Query('priority')    priority?:    string,
    @Query('tenantId')    tenantId?:    string,
    @Query('assignedTo')  assignedTo?:  string,
    @Query('slaBreached') slaBreached?: string,
  ) {
    return this.svc.listAll({
      status, priority, tenantId, assignedTo,
      slaBreached: slaBreached === 'true' ? true : undefined,
    });
  }

  @Get('admin/stats')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Ticket stats with SLA breach count' })
  stats() { return this.svc.stats(); }

  @Patch('admin/tickets/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update ticket (status, priority, assign)' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTicketDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.svc.update(id, dto, u.id);
  }

  @Post('admin/tickets/:id/messages')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Superadmin reply' })
  adminMessage(
    @Param('id') id: string,
    @Body() dto: AddMessageDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.svc.addMessage(id, dto, u.id, 'SUPER_ADMIN');
  }

  @Post('admin/sla/run')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger SLA check + escalation' })
  runSLA() { return this.svc.runSLACheck(); }
}
