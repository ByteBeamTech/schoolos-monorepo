import { Controller, Get, Post, Body, Param, Query, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { HomeworkService }   from '../services/homework.service';
import { CreateHomeworkDto } from '../dto/homework.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('homework')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('homework')
export class HomeworkController {
  constructor(private readonly svc: HomeworkService) {}

  @Get('stats') stats(@CurrentUser() u: AuthenticatedUser) { return this.svc.stats(u.tenantId); }

  @Get()
  @ApiQuery({ name: 'classId',   required: false })
  @ApiQuery({ name: 'subjectId', required: false })
  list(
    @CurrentUser() u: AuthenticatedUser,
    @Query('classId')   classId?:   string,
    @Query('subjectId') subjectId?: string,
  ) { return this.svc.list(u.tenantId, { classId, subjectId }); }

  @Post()
  @Roles('TEACHER', 'CLASS_TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL')
  create(@Body() dto: CreateHomeworkDto, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.create(u.tenantId, dto, u.id);
  }

  @Get(':id/submissions')
  getSubmissions(@Param('id') id: string, @CurrentUser() u: AuthenticatedUser) {
    return this.svc.getSubmissions(u.tenantId, id);
  }

  @Post(':id/submit')
  submit(
    @Param('id') id: string,
    @Body('studentId') studentId: string,
    @CurrentUser() u: AuthenticatedUser,
  ) { return this.svc.markSubmitted(u.tenantId, id, studentId); }

  @Post(':id/grade')
  @Roles('TEACHER', 'CLASS_TEACHER', 'SCHOOL_ADMIN', 'PRINCIPAL')
  grade(
    @Param('id')         id:        string,
    @Body('studentId')   studentId: string,
    @Body('marks')       marks:     number,
    @CurrentUser()       u:         AuthenticatedUser,
    @Body('remarks')     remarks?:  string,
  ) { return this.svc.gradeSubmission(u.tenantId, id, studentId, marks, remarks); }
}
