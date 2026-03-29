// backend/src/modules/behavior/controllers/behavior.controller.ts
import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { BehaviorService }         from '../services/behavior.service';
import { CreateBehaviorRecordDto, ResolveRecordDto } from '../dto/behavior.dto';
import { JwtGuard }                from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }              from '../../../core/roles/roles.guard';
import { Roles }                   from '../../../core/roles/roles.decorator';
import { CurrentUser }             from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser }       from '../../../core/auth/guards/jwt.strategy';

@ApiTags('behavior')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('behavior')
export class BehaviorController {
  constructor(private readonly svc: BehaviorService) {}

  @Get()
  @ApiOperation({ summary: 'List behavior records' })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'type',      required: false })
  @ApiQuery({ name: 'from',      required: false })
  @ApiQuery({ name: 'to',        required: false })
  @ApiQuery({ name: 'page',      required: false })
  @ApiQuery({ name: 'limit',     required: false })
  list(
    @CurrentUser() u: AuthenticatedUser,
    @Query('studentId') studentId?: string,
    @Query('type')      type?:      string,
    @Query('from')      from?:      string,
    @Query('to')        to?:        string,
    @Query('page')      page?:      number,
    @Query('limit')     limit?:     number,
  ) {
    return this.svc.list(u.tenantId, { studentId, type, from, to, page, limit });
  }

  @Get('student/:studentId')
  @ApiOperation({ summary: 'Get all behavior records for a student' })
  getByStudent(
    @Param('studentId') studentId: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.svc.getByStudent(u.tenantId, studentId);
  }

  @Get('student/:studentId/summary')
  @ApiOperation({ summary: 'Get behavior summary for a student' })
  getSummary(
    @Param('studentId') studentId: string,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.svc.getStudentSummary(u.tenantId, studentId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single behavior record' })
  getById(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.getById(u.tenantId, id);
  }

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'CLASS_TEACHER', 'TEACHER', 'COUNSELLOR')
  @ApiOperation({ summary: 'Create a behavior record' })
  create(@Body() dto: CreateBehaviorRecordDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.create(u.tenantId, dto, u.id);
  }

  @Patch(':id/resolve')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'CLASS_TEACHER', 'COUNSELLOR')
  @ApiOperation({ summary: 'Resolve a behavior record' })
  resolve(
    @Param('id') id: string,
    @Body() dto: ResolveRecordDto,
    @CurrentUser() u: AuthenticatedUser,
  ) {
    return this.svc.resolve(u.tenantId, id, u.id, dto.resolutionNote);
  }

  @Delete(':id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Delete a behavior record' })
  delete(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.delete(u.tenantId, id);
  }
}
