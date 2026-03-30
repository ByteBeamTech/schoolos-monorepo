import {
  Controller, Get, Post, Patch, Param,
  Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StudentsService }   from '../services/students.service';
import {
  CreateStudentDto, UpdateStudentDto,
  CreateGuardianDto, LinkGuardianDto,
} from '../dto/student.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('students')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('students')
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Enroll a new student' })
  create(
    @Body() dto: CreateStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List students' })
  @ApiQuery({ name: 'academicYear', required: false })
  @ApiQuery({ name: 'sectionId',   required: false })
  @ApiQuery({ name: 'search',      required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYear') academicYear?: string,
    @Query('sectionId')    sectionId?:   string,
    @Query('search')       search?:      string,
    @Query('page')         page?:        string,
    @Query('limit')        limit?:       string,
  ) {
    return this.service.findAll(user.tenantId, {
      page:  page  ? +page  : 1,
      limit: limit ? +limit : 20, academicYear, sectionId, search });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get student stats for academic year' })
  @ApiQuery({ name: 'academicYear', required: true })
  getStats(
    @CurrentUser() user: AuthenticatedUser,
    @Query('academicYear') academicYear: string,
  ) {
    return this.service.getStats(user.tenantId, academicYear);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get student by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findById(user.tenantId, id);
  }

  @Patch(':id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Update student' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStudentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(user.tenantId, id, dto, user.id);
  }

  @Post('guardians')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Create a guardian' })
  createGuardian(
    @Body() dto: CreateGuardianDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createGuardian(user.tenantId, dto, user.id);
  }

  @Post(':id/guardians/link')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'ACCOUNTANT')
  @ApiOperation({ summary: 'Link existing guardian to student' })
  linkGuardian(
    @Param('id') id: string,
    @Body() dto: LinkGuardianDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.linkGuardian(user.tenantId, id, dto, user.id);
  }

  @Get(':id/guardians')
  @ApiOperation({ summary: 'Get all guardians for a student' })
  getGuardians(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getGuardians(user.tenantId, id);
  }
}
