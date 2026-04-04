import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ExaminationsService }   from '../services/examinations.service';
import { CreateExamDto, UpdateExamDto, CreateExamScheduleDto, BulkMarkEntryDto } from '../dto/examinations.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('examinations')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('examinations')
export class ExaminationsController {
  constructor(private readonly service: ExaminationsService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create an exam' })
  create(@Body() dto: CreateExamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createExam(user.tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List exams for a session' })
  @ApiQuery({ name: 'sessionId', required: true })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('sessionId') sessionId: string) {
    return this.service.listExams(user.tenantId, sessionId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Exam stats for session' })
  @ApiQuery({ name: 'sessionId', required: true })
  getStats(@CurrentUser() user: AuthenticatedUser, @Query('sessionId') sessionId: string) {
    return this.service.getExamStats(user.tenantId, sessionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get exam with schedules' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getExam(user.tenantId, id);
  }

  @Patch(':id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update exam' })
  update(@Param('id') id: string, @Body() dto: UpdateExamDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateExam(user.tenantId, id, dto);
  }

  @Post(':id/publish')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Publish exam (visible to teachers/parents)' })
  publish(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.publishExam(user.tenantId, id);
  }

  @Post(':id/schedules')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Add subject schedule to an exam' })
  addSchedule(@Param('id') id: string, @Body() dto: CreateExamScheduleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createSchedule(user.tenantId, id, dto);
  }

  @Post('marks/bulk')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Enter marks for multiple students' })
  enterMarks(@Body() dto: BulkMarkEntryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.bulkEnterMarks(user.tenantId, dto, user.id);
  }

  @Get(':id/results/class/:classId')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  @ApiOperation({ summary: 'Get class results for an exam' })
  classResults(@Param('id') id: string, @Param('classId') classId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getClassResults(user.tenantId, id, classId);
  }

  @Get(':id/results/student/:studentId')
  @ApiOperation({ summary: 'Get student result for an exam' })
  studentResult(@Param('id') id: string, @Param('studentId') studentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getStudentResult(user.tenantId, id, studentId);
  }
}
