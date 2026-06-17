import { Put, Controller, Get, Post, Patch, Delete, Body, Param, UseGuards }  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { TimetableService }        from '../services/timetable.service';
import { CreateTimetableSlotDto, UpdateTimetableSlotDto, BulkCreateTimetableDto } from '../dto/timetable.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('timetable')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('timetable')
export class TimetableController {
  constructor(private readonly service: TimetableService) {}

  @Post()
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create a single timetable slot' })
  create(@Body() dto: CreateTimetableSlotDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.createSlot(user.tenantId, dto);
  }

  @Post('bulk')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Bulk create timetable for a section' })
  bulkCreate(@Body() dto: BulkCreateTimetableDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.bulkCreate(user.tenantId, dto);
  }

  @Get('section/:sectionId')
  @ApiOperation({ summary: 'Get weekly timetable for a section' })
  getSectionTimetable(@Param('sectionId') sectionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getWeeklyTimetable(user.tenantId, sectionId);
  }

  @Get('teacher/:teacherId')
  @ApiOperation({ summary: 'Get weekly timetable for a teacher' })
  getTeacherTimetable(@Param('teacherId') teacherId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.getTeacherTimetable(user.tenantId, teacherId);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update a timetable slot' })
  update(@Param('id') id: string, @Body() dto: UpdateTimetableSlotDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.updateSlot(user.tenantId, id, dto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Remove a timetable slot' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.deleteSlot(user.tenantId, id);
  }

  @Delete('section/:sectionId/clear')
  @Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Clear entire section timetable' })
  clearSection(@Param('sectionId') sectionId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.clearSection(user.tenantId, sectionId);
  }

  @Put('section/:sectionId')
@Roles('SUPER_ADMIN', 'SCHOOL_ADMIN', 'PRINCIPAL')
@ApiOperation({
  summary: 'Replace entire timetable for a section',
})
replaceSectionTimetable(
  @Param('sectionId') sectionId: string,
  @Body() dto: { slots: any[] },
  @CurrentUser() user: AuthenticatedUser,
) {
  return this.service.replaceSectionTimetable(
    user.tenantId,
    sectionId,
    dto.slots,
  );
}

  @Get("section/:sectionId/full")
  @Roles("SUPER_ADMIN", "SCHOOL_ADMIN", "PRINCIPAL", "TEACHER", "CLASS_TEACHER", "PARENT")
  @ApiOperation({ summary: "Weekly timetable with subject and teacher names" })
  getFullTimetable(
    @Param("sectionId") sectionId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.getWeeklyTimetableWithSubjects(user.tenantId, sectionId);
  } 
}
