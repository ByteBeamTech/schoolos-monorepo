import { Controller, Get, Post, Patch, Param, Query, Version } from '@nestjs/common';
import { ReadinessCheckDto } from '../dto/readiness-check.dto';
import {
  Body, UseGuards, HttpCode, HttpStatus,
}  from '@nestjs/common';
import {
  ApiTags, ApiBearerAuth, ApiOperation,
} from '@nestjs/swagger';
import { AcademicSessionsService }    from '../services/academic-sessions.service';
import { CreateAcademicSessionDto, UpdateAcademicSessionDto } from '../dto/academic-session.dto';
import { JwtGuard }          from '../../auth/guards/jwt.guard';
import { RolesGuard }        from '../../roles/roles.guard';
import { Roles }             from '../../roles/roles.decorator';
import { CurrentUser }       from '../../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/guards/jwt.strategy';

@ApiTags('academic-sessions')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('academic-sessions')
export class AcademicSessionsController {
  constructor(private readonly service: AcademicSessionsService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create academic session' })
  create(
    @Body() dto: CreateAcademicSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(user.tenantId, dto, user.id);
  }

  @Get()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'ACCOUNTANT')
  @ApiOperation({ summary: 'List all academic sessions' })
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAll(user.tenantId);
  }

  @Get('current')
  @ApiOperation({ summary: 'Get current active session' })
  findCurrent(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findCurrent(user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get session by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findById(user.tenantId, id);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get session stats (classes, students)' })
  getStats(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getStats(user.tenantId, id);
  }

  @Patch(':id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update academic session' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicSessionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(user.tenantId, id, dto, user.id);
  }

  @Patch(':id/set-current')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set session as current active session' })
  setCurrent(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setCurrent(user.tenantId, id, user.id);
  }

  @Patch(':id/lock')
  @Roles('SCHOOL_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lock session — prevents further edits after year-end' })
  lock(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.lock(user.tenantId, id, user.id);
  }

@Post('readiness-check')
@Roles('SCHOOL_ADMIN', 'PRINCIPAL')
readinessCheck(
  @CurrentUser() user: AuthenticatedUser,
  @Body() dto: ReadinessCheckDto,
) {
  return this.service.readinessCheck(
    user.tenantId,
    dto.targetSessionId,
  );
}

@Patch(':id/unlock')
@Roles('SUPER_ADMIN', 'SCHOOL_ADMIN')
@HttpCode(HttpStatus.OK)
@ApiOperation({ summary: 'Unlock academic session' })
unlock(
  @Param('id') id: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.service.unlock(
    user.tenantId,
    id,
    user.id,
  );
}

}
