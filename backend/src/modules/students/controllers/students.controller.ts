// /apps/schoolos/backend/src/modules/students/controllers/students.controller.ts

import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { StudentsService } from '../services/students.service';
import { CreateStudentDto, UpdateStudentDto, LinkGuardianDto } from '../dto/student.dto';

import { JwtGuard } from '@core/auth/guards/jwt.guard';
import { RolesGuard } from '@core/roles/roles.guard';
import { Roles } from '@core/roles/roles.decorator';
import { CurrentUser } from '@core/auth/decorators/current-user.decorator'; // 🟢 FIX #7: Checked filename verification
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface'; 

@Controller('students')
@UseGuards(JwtGuard, RolesGuard)
export class StudentsController {
  constructor(private readonly service: StudentsService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  async create(@Body() dto: CreateStudentDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.branchId) throw new Error('Branch context is mandatory for student creation.');
    return this.service.create(user.tenantId, user.branchId, dto, user.id);
  }

  @Get()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async findAll(
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('academicYear') academicYear: string,
    @Query('sectionId') sectionId: string,
    @Query('search') search: string,
    @CurrentUser() user: AuthenticatedUser
  ) {
    if (!user.branchId) throw new Error('Branch context mapping required for listing views.');
    return this.service.findAll(user.tenantId, user.branchId, {
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      academicYear,
      sectionId,
      search,
    });
  }

  @Get('stats')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER')
  async getStats(@Query('academicYear') academicYear: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.branchId) throw new Error('Branch context mapping required for statistics computation.');
    return this.service.getStats(user.tenantId, user.branchId, academicYear);
  }

  @Get(':id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT')
  async findById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.branchId) throw new Error('Branch context constraint verified missing.');
    return this.service.findById(user.tenantId, user.branchId, id);
  }

  @Patch(':id') 
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  async update(@Param('id') id: string, @Body() dto: UpdateStudentDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.branchId) throw new Error('Branch validation ownership verification failed.');
    // 🟢 FIX #1: Aligned strictly to convention guidelines order: tenantId, branchId, resourceId
    return this.service.update(user.tenantId, user.branchId, id, dto, user.id);
  }

  @Post(':id/guardians')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  async linkGuardian(@Param('id') id: string, @Body() dto: LinkGuardianDto, @CurrentUser() user: AuthenticatedUser) {
    if (!user.branchId) throw new Error('Branch checkpoint failed.');
    return this.service.linkGuardian(user.tenantId, user.branchId, id, dto, user.id);
  }

  @Get(':id/guardians')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL', 'TEACHER', 'PARENT')
  async getGuardians(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    if (!user.branchId) throw new Error('Branch check aborted.');
    return this.service.getGuardians(user.tenantId, user.branchId, id);
  }
}
