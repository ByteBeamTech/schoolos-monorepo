import {
  Controller, Get, Post, Patch, Body, Param,
  Query, UseGuards, HttpCode, HttpStatus,
}  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtGuard }           from '../../../core/auth/guards/jwt.guard';
import { JwtSuperadminGuard } from '../../../core/auth/guards/jwt-superadmin.guard';
import { SuperadminRoute }    from '../../../core/auth/decorators/superadmin-route.decorator';
import { RolesGuard }   from '../../../core/roles/roles.guard';
import { Roles }        from '../../../core/roles/roles.decorator';
import { CurrentUser }  from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';
import { SupportService }    from '../services/support.service';
import { CreateTicketDto, UpdateTicketDto, AddMessageDto } from '../dto/support.dto';

// SA-1A-pattern fix (found post-UI-0.5, via real usage): the 5 routes
// under "── Superadmin ──" below were @Roles('SUPER_ADMIN')-scoped but
// this class's guard was plain JwtGuard with no @SuperadminRoute()
// marker -- identical root cause to the original SA-1A finding. Unlike
// tenant-admin.controller.ts (100% superadmin, fixed at class level),
// this controller genuinely mixes tenant-facing ticket routes (create,
// list, getOne, addMessage, reopen -- all operate on the calling user's
// own tenantId) with superadmin admin/* routes, so per SA-1A's original
// methodology, guards move to per-method here instead of class level --
// class-level @UseGuards removed, each method now states its own guard
// explicitly, exactly as core/feature-flags/feature-flags.controller.ts
// already does.
@ApiTags('support')
@ApiBearerAuth('access-token')
@Controller('support')
export class SupportController {
  constructor(private readonly svc: SupportService) {}

  // ── School-facing ─────────────────────────────────────────────────────────

  @Post('tickets')
  @UseGuards(JwtGuard, RolesGuard)
  @ApiOperation({ summary: 'Create support ticket' })
  create(@Body() dto: CreateTicketDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.create(u.tenantId, dto, u.id);
  }

  @Get('tickets')
  @UseGuards(JwtGuard, RolesGuard)
  @ApiOperation({ summary: 'List my tickets' })
  @ApiQuery({ name: 'status', required: false })
  list(@CurrentUser() u: AuthenticatedUser, @Query('status') status?: string) {
    return this.svc.listByTenant(u.tenantId, status);
  }

  @Get('tickets/:id')
  @UseGuards(JwtGuard, RolesGuard)
  @ApiOperation({ summary: 'Get ticket with messages' })
  getOne(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.getById(id, u.tenantId);
  }

  @Post('tickets/:id/messages')
  @UseGuards(JwtGuard, RolesGuard)
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
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
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
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Ticket stats with SLA breach count' })
  stats() { return this.svc.stats(); }

  // BUG FIX (found via real usage: clicking a ticket in the Support page's
  // list never loaded the detail panel -- "Select a ticket to view"
  // persisted forever). Root cause: the frontend already called
  // GET /support/admin/tickets/:id, but this route never existed --
  // only the tenant-facing GET tickets/:id (scoped to the caller's own
  // tenantId) did, which a superadmin viewing an arbitrary tenant's
  // ticket can't use. The service method (getById) already accepted an
  // optional tenantId and correctly skips tenant-scoping when omitted --
  // no service change needed, just this missing route.
  @Get('admin/tickets/:id')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get any ticket by id, across all tenants (superadmin)' })
  getOneAdmin(@Param('id') id: string) {
    return this.svc.getById(id);
  }

  @Patch('admin/tickets/:id')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
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
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Superadmin reply' })
  adminMessage(
    @Param('id') id: string,
    @Body() dto: AddMessageDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.svc.addMessage(id, dto, u.id, 'SUPER_ADMIN');
  }

  @Patch('tickets/:id/reopen')
  @UseGuards(JwtGuard, RolesGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reopen a resolved or closed ticket' })
  reopen(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.reopen(id, u.tenantId);
  }

  @Post('admin/sla/run')
  @SuperadminRoute()
  @UseGuards(JwtSuperadminGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually trigger SLA check + escalation' })
  runSLA() { return this.svc.runSLACheck(); }
}
