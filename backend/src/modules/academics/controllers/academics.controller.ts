import { SaveTeacherGridDto } from '../dto/teacher-grid.dto';
import {
  Controller, Get, Post, Patch, Param,
  Body, Query, UseGuards,
}  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AcademicsService } from '../services/academics.service';
import {
  CreateClassDto, UpdateClassDto,
  CreateSectionDto, UpdateSectionDto,
  CreateSubjectDto, UpdateSubjectDto,
  AssignTeacherDto, CreateSubjectMappingDto, GenerateRollNumbersDto,
} from '../dto/academics.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('academics')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('academics')
export class AcademicsController {
  constructor(private readonly service: AcademicsService) {}

  // ── Classes ───────────────────────────────────────────────────────────────

  @Post('classes')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create a class' })
  createClass(
    @Body() dto: CreateClassDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createClass(user.tenantId, user.branchId!, dto, user.id);
  }

  @Get('classes')
  @ApiOperation({ summary: 'List all classes for a session' })
  @ApiQuery({ name: 'sessionId', required: true })
  findAllClasses(
    @Query('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findAllClasses(user.tenantId, user.branchId!, sessionId);
  }

  @Get('classes/:id')
  @ApiOperation({ summary: 'Get class by ID' })
  findClass(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findClassById(user.tenantId, id);
  }

  @Patch('classes/:id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update class' })
  updateClass(
    @Param('id') id: string,
    @Body() dto: UpdateClassDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateClass(user.tenantId, id, dto, user.id);
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  @Post('sections')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create a section' })
  createSection(
    @Body() dto: CreateSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createSection(user.tenantId, user.branchId!, dto, user.id);
  }

  @Get('sections')
@ApiOperation({ summary: 'List sections by class' })
@ApiQuery({ name: 'classId', required: true })
findSections(
  @Query('classId') classId: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.service.findSectionsByClass(
    user.tenantId,
    classId,
  );
}

  @Get('sections/:id')
  @ApiOperation({ summary: 'Get section by ID' })
  findSection(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findSectionById(user.tenantId, id);
  }

  @Patch('sections/:id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update section' })
  updateSection(
    @Param('id') id: string,
    @Body() dto: UpdateSectionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateSection(user.tenantId, id, dto, user.id);
  }

  // ── Subjects ──────────────────────────────────────────────────────────────

  @Post('subjects')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create a subject' })
  createSubject(
    @Body() dto: CreateSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createSubject(user.tenantId, dto, user.id);
  }

  @Get('subjects')
  @ApiOperation({ summary: 'List all subjects' })
  findAllSubjects(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findAllSubjects(user.tenantId);
  }

  @Get('subjects/:id')
  @ApiOperation({ summary: 'Get subject by ID' })
  findSubject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findSubjectById(user.tenantId, id);
  }

  @Patch('subjects/:id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update subject' })
  updateSubject(
    @Param('id') id: string,
    @Body() dto: UpdateSubjectDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.updateSubject(user.tenantId, id, dto, user.id);
  }

  // ── Teacher Mapping ───────────────────────────────────────────────────────

  @Post('teacher-mappings')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Assign teacher to subject+section' })
  assignTeacher(
    @Body() dto: AssignTeacherDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.assignTeacher(user.tenantId, dto, user.id);
  }

  @Get('teacher-mappings')
  @ApiOperation({ summary: 'Get teacher mappings for session' })
  @ApiQuery({ name: 'sessionId', required: true })
  @ApiQuery({ name: 'sectionId', required: false })
  getTeacherMappings(
    @Query('sessionId') sessionId: string,
    @Query('sectionId') sectionId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getTeacherMappings(user.tenantId, user.branchId!, sessionId, sectionId);
  }

  // ── Subject Mappings ──────────────────────────────────────────────────────

  @Post('subject-mappings')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Map a subject to a class' })
  createSubjectMapping(
    @Body() dto: CreateSubjectMappingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createSubjectMapping(user.tenantId, dto, user.id);
  }

  @Get('subject-mappings')
  @ApiOperation({ summary: 'Get subject mappings' })
  @ApiQuery({ name: 'classId',   required: false })
  @ApiQuery({ name: 'sessionId', required: false })
  getSubjectMappings(
    @Query('classId')   classId:   string | undefined,
    @Query('sessionId') sessionId: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getSubjectMappings(user.tenantId, classId, sessionId);
  }

  // ── Class Teacher Appointments ────────────────────────────────────────────

  @Post('sections/:id/assign-class-teacher')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'VICE_PRINCIPAL')
  @ApiOperation({ summary: 'Appoint a teacher as class teacher of a section' })
  assignClassTeacher(
    @Param('id') sectionId: string,
    @Body() body: { staffId: string | null },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.assignClassTeacher(user.tenantId, sectionId, body.staffId, user.id);
  }

  @Get('class-teacher-appointments')
  @ApiOperation({ summary: 'Get all class teacher appointments for a session' })
  @ApiQuery({ name: 'sessionId', required: true })
  getClassTeacherAppointments(
    @Query('sessionId') sessionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getClassTeacherAppointments(user.tenantId, user.branchId!, sessionId);
  }
@Post('roll-numbers/generate')
@Roles('SCHOOL_ADMIN', 'PRINCIPAL')
@ApiOperation({ summary: 'Generate roll numbers for a section' })
generateRollNumbers(
  @Body() dto: GenerateRollNumbersDto,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.service.generateRollNumbers(
    user.tenantId,
    user.branchId!,
    dto,
    user.id,
  );
}
  @Get('sessions')
findSessions(@CurrentUser() user: AuthenticatedUser) {
  return this.service.findSessions(user.tenantId);
}

@Get('sections/:sectionId/teacher-grid')
@Roles('SCHOOL_ADMIN', 'PRINCIPAL')
@ApiOperation({
  summary: 'Get teacher assignment grid for a section',
})
getTeacherGrid(
  @Param('sectionId') sectionId: string,
  @Query('academicYearId') academicYearId: string,
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.service.getTeacherAssignmentGrid(
    user.tenantId,
    sectionId,
    academicYearId,
  );
}

@Post('sections/:sectionId/teacher-grid')
@Roles('SCHOOL_ADMIN', 'PRINCIPAL')
@ApiOperation({
  summary: 'Save teacher assignments for a section',
})
saveTeacherGrid(
  @Param('sectionId') sectionId: string,

  @Body()
  body: {
    academicYearId: string;
    assignments: {
      subjectId: string;
      teacherId: string;
    }[];
  },

  @CurrentUser() user: AuthenticatedUser,
) {
  return this.service.saveTeacherAssignmentGrid(
    user.tenantId,
    sectionId,
    body.academicYearId,
    body.assignments,
  );
}
}
