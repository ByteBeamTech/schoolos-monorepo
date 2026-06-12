import {
  Controller, Get, Post, Patch, Param,
  Body, Query, UseGuards,
}  from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StaffService }      from '../services/staff.service';
import { CreateStaffDto, UpdateStaffDto } from '../dto/staff.dto';
import { JwtGuard }          from '../../../core/auth/guards/jwt.guard';
import { RolesGuard }        from '../../../core/roles/roles.guard';
import { Roles }             from '../../../core/roles/roles.decorator';
import { CurrentUser }       from '../../../core/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../../core/auth/guards/jwt.strategy';

@ApiTags('staff')
@ApiBearerAuth('access-token')
@UseGuards(JwtGuard, RolesGuard)
@Controller('staff')
export class StaffController {
  constructor(private readonly service: StaffService) {}

  @Post()
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Create staff profile for existing user' })
  create(
    @Body() dto: CreateStaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.create(user.tenantId, dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'List all staff' })
  @ApiQuery({ name: 'department', required: false })
  @ApiQuery({ name: 'search',     required: false })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('department') department?: string,
    @Query('search')     search?:     string,
  ) {
    return this.service.findAll(user.tenantId, { department, search });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get staff by ID' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findById(user.tenantId, id);
  }

  @Patch(':id')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Update staff profile' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(user.tenantId, id, dto, user.id);
  }

  // ── Subject preferences ───────────────────────────────────────────────────

  @Post(':id/subject-preferences')
  @Roles('SCHOOL_ADMIN', 'PRINCIPAL')
  @ApiOperation({ summary: 'Set subjects a teacher can teach' })
  async setSubjectPreferences(
    @Param('id') staffId: string,
    @Body() body: { subjectIds: string[] },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { tenantId } = user;
    // Delete existing preferences and recreate (full replace)
    await (this.service as any).prisma.teacherSubjectPreference.deleteMany({
      where: { tenantId, staffId },
    });
    if (body.subjectIds?.length) {
      await (this.service as any).prisma.teacherSubjectPreference.createMany({
        data: body.subjectIds.map((subjectId: string) => ({ tenantId, staffId, subjectId })),
        skipDuplicates: true,
      });
    }
    return { staffId, subjectIds: body.subjectIds ?? [] };
  }

  @Get(':id/subject-preferences')
  @ApiOperation({ summary: 'Get subjects a teacher can teach' })
  async getSubjectPreferences(
    @Param('id') staffId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const prefs = await (this.service as any).prisma.teacherSubjectPreference.findMany({
      where:   { tenantId: user.tenantId, staffId },
      include: { subject: { select: { id: true, name: true, code: true,  } } },
    });
    return prefs.map((p: any) => p.subject);
  }
}
