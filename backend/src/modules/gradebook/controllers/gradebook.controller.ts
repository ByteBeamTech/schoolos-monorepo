import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { GradebookService }    from '../services/gradebook.service';
import { CreateGradeBoundaryDto } from '../dto/gradebook.dto';
import { JwtGuard }            from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }          from '../../../core/roles/roles.guard';
import { Roles }               from '../../../core/roles/roles.decorator';
import { CurrentUser }         from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser }   from '../../../core/auth/guards/jwt.strategy';

@ApiTags('gradebook')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('gradebook')
export class GradebookController {
  constructor(private readonly svc: GradebookService) {}

  @Get('boundaries')
  @ApiQuery({ name: 'sessionId', required: true })
  getBoundaries(@CurrentUser() u: AuthenticatedUser, @Query('sessionId') sessionId: string) {
    return this.svc.getBoundaries(u.tenantId, sessionId);
  }

  @Post('boundaries')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  createBoundary(@Body() dto: CreateGradeBoundaryDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.createBoundary(u.tenantId, dto);
  }

  @Delete('boundaries/:id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  deleteBoundary(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.deleteBoundary(u.tenantId, id);
  }

  @Get('results')
  @ApiQuery({ name: 'examId',    required: true })
  @ApiQuery({ name: 'classId',   required: true })
  @ApiQuery({ name: 'sessionId', required: true })
  getResults(
    @CurrentUser() u: AuthenticatedUser,
    @Query('examId')    examId:    string,
    @Query('classId')   classId:   string,
    @Query('sessionId') sessionId: string,
  ) { return this.svc.getClassResults(u.tenantId, examId, classId, sessionId); }
}
