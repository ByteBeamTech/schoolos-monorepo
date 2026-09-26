// /apps/schoolos/backend/src/modules/admissions/controllers/admissions.controller.ts

import { Controller, Post, Param, Body, UseGuards, Get, Query } from '@nestjs/common';
import { AdmissionsService } from '../services/admissions.service';

// 🔐 AUTH & ROLES CANONICAL SHORTCUTS
import { JwtGuard } from '@core/auth/guards/jwt.guard'; 
import { RolesGuard } from '@core/roles/roles.guard';    
import { Roles } from '@core/roles/roles.decorator';  
import { CurrentUser } from '@core/auth/decorators/current-user.decorator'; // 🟢 FIXED: Swapped to exact physical filename
import { AuthenticatedUser } from '@core/auth/interfaces/authenticated-user.interface'; 

import { AllocateSeatDto, CreateAdmissionDto, FinalizeEnrollmentDto } from '../dto/admissions.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '@infra/database/prisma.service';
import { AdmissionStep, AdmissionStepStatus } from '@prisma/client';

@ApiTags('Institutional Admissions Gateway')
@ApiBearerAuth()
@Controller('admissions')
@UseGuards(JwtGuard, RolesGuard)
export class AdmissionsController {
  constructor(
    private readonly service: AdmissionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles('SCHOOL_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'REGISTRAR', 'ACCOUNTANT')
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: AdmissionStepStatus,
    @Query('search') search?: string,
  ) {
    const admissions = await this.prisma.admission.findMany({
      where: {
        tenantId: user.tenantId,
        branchId: user.branchId,
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { fatherPhone: { contains: search } },
                { guardianPhone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return admissions.map((admission) => ({
      ...admission,
      applicationNo: admission.id,
      applyingForClass: admission.applyingClassId ?? '—',
      phone: admission.guardianPhone ?? admission.fatherPhone ?? admission.alternatePhone ?? '',
    }));
  }

  @Get('stats')
  @Roles('SCHOOL_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'REGISTRAR', 'ACCOUNTANT')
  async stats(@CurrentUser() user: AuthenticatedUser) {
    const where = { tenantId: user.tenantId, branchId: user.branchId };
    const [total, grouped] = await Promise.all([
      this.prisma.admission.count({ where }),
      this.prisma.admission.groupBy({ by: ['status'], where, _count: { id: true } }),
    ]);
    const byStatus = Object.fromEntries(
      grouped.map((entry) => [entry.status, entry._count.id]),
    );
    const enrolled = byStatus[AdmissionStepStatus.CONVERTED] ?? 0;

    return {
      total,
      thisMonth: total,
      enrolled,
      inquiries: total - enrolled,
      conversionRate: total ? Math.round((enrolled / total) * 100) : 0,
      byStatus,
    };
  }

  @Post()
  @Roles('SCHOOL_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'REGISTRAR')
  async create(
    @Body() dto: CreateAdmissionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const admission = await this.prisma.admission.create({
      data: {
        tenantId: user.tenantId,
        branchId: user.branchId,
        step: AdmissionStep.FORM_SUBMISSION,
        status: AdmissionStepStatus.INQUIRY,
        firstName: dto.firstName,
        middleName: dto.middleName,
        lastName: dto.lastName,
        dateOfBirth: new Date(dto.dateOfBirth),
        gender: dto.gender,
        bloodGroup: dto.bloodGroup,
        category: dto.category,
        religion: dto.religion,
        nationality: dto.nationality,
        fatherPhone: dto.fatherPhone,
        motherPhone: dto.motherPhone,
        guardianPhone: dto.guardianPhone ?? dto.phone,
        guardianRelation: dto.guardianRelation,
        email: dto.email,
        applyingClassId: dto.applyingClassId,
        academicYear: dto.academicYear,
        previousSchoolName: dto.previousSchool,
        previousClass: dto.previousClass,
        medicalConditions: dto.medicalConditions,
        allergies: dto.allergies,
        transportRequired: dto.transportRequired,
        pickupLocation: dto.pickupLocation,
        notes: dto.notes,
        source: dto.sourceId,
      },
    });

    return {
      ...admission,
      applicationNo: admission.id,
      applyingForClass: admission.applyingClassId ?? '—',
      phone: admission.guardianPhone ?? admission.fatherPhone ?? '',
    };
  }

  @Post(':id/allocate-seat')
  @Roles('ADMIN', 'REGISTRAR')
  @ApiOperation({ summary: 'Acquire Pessimistic Section Seat Allocation Lock' })
  async allocateSeat(
    @Param('id') id: string, 
    @Body() dto: AllocateSeatDto, 
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.allocateSeat(user.tenantId, user.branchId!, id, dto.sectionId, user.id);
  }

  @Post(':id/finalize-enrollment')
  @Roles('ADMIN', 'REGISTRAR')
  @ApiOperation({ summary: 'Commit Atomic Relational Student Enrollment Handshake' })
  async finalize(
    @Param('id') id: string,
    @Body() dto: FinalizeEnrollmentDto, 
    @CurrentUser() user: AuthenticatedUser
  ) {
    return this.service.finalizeEnrollment(user.tenantId, user.branchId!, id, dto.rollNumber, user.id);
  }
}
