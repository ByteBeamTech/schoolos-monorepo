// /apps/schoolos/backend/src/modules/admissions/services/admissions.service.ts

import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import { EntitlementResolver } from '@core/license/entitlement-resolver.service';
import { ApplicationStatus, AdmissionStepStatus, StudentStatus } from '@prisma/client';

@Injectable()
export class AdmissionsService {
  private readonly logger = new Logger(AdmissionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly entitlementResolver: EntitlementResolver,
  ) {}

  private generateAdmissionNumber(crmNo: string): string {
    if (!crmNo) throw new BadRequestException('CRM Tracking Identification token corrupted.');
    return crmNo.trim().toUpperCase().replace('CRM-', 'ADM-'); 
  }

  async allocateSeat(tenantId: string, branchId: string, applicationId: string, sectionId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const app = await tx.admissionApplication.findFirst({
        where: { id: applicationId, tenantId, branchId, isDeleted: false }
      });
      if (!app) throw new NotFoundException('Admission Application details missing or deactivated.');
      if (app.status === ApplicationStatus.APPROVED) {
        throw new BadRequestException(`Seat already reserved for application matching crmNo: ${app.crmNo}`);
      }
      if (!app.applyingClassId) {
        throw new BadRequestException('Relational Block: Application missing critical applyingClassId property.');
      }

      const targetSection = await tx.section.findFirst({
        where: { id: sectionId, tenantId, branchId, classId: app.applyingClassId }
      });
      if (!targetSection) throw new NotFoundException('Selected target Section structure mismatch within Class blueprint.');

      await tx.$executeRaw`
        SELECT id FROM "Section" WHERE id = ${sectionId} AND "tenantId" = ${tenantId} AND "branchId" = ${branchId} FOR UPDATE;
      `;

      const activeEnrolledCount = await tx.student.count({ where: { tenantId, branchId, sectionId, isActive: true } });
      const temporaryReservedCount = await tx.admissionApplication.count({
        where: {
          tenantId, branchId, status: ApplicationStatus.APPROVED,
          formDetails: { path: ['reservedSectionId'], equals: sectionId }
        }
      });

      if (activeEnrolledCount + temporaryReservedCount + 1 > targetSection.capacity) {
        throw new BadRequestException('Seat allocation aborted: Dynamic occupancy boundary breach on Section capacity.');
      }

      const currentFormDetails = typeof app.formDetails === 'object' && app.formDetails !== null ? (app.formDetails as Record<string, any>) : {};
      const updatedFormDetails = { ...currentFormDetails, reservedSectionId: sectionId };

      return tx.admissionApplication.update({
        where: { id: applicationId },
        data: { 
          status:      ApplicationStatus.APPROVED,
          stepStatus:  AdmissionStepStatus.FEE_DEPOSIT, 
          sectionId:   sectionId,
          formDetails: updatedFormDetails,
          updatedById: actorId
        },
      });
    });
  }

  async finalizeEnrollment(tenantId: string, branchId: string, applicationId: string, rollNumber: string, actorId: string) {
    // PR-5B: same quota gate as StudentsService.create() -- this is a
    // second live path that creates a Student row (admission -> student
    // conversion) and must not bypass the license/quota check.
    await this.entitlementResolver.assertCanEnrollStudent(tenantId);

    return this.prisma.$transaction(async (tx) => {
      const app = await tx.admissionApplication.findFirst({
        where: { id: applicationId, tenantId, branchId, isDeleted: false },
        include: { primaryStudent: true } 
      });
      if (!app) throw new NotFoundException('Application context record missing inside database registries.');

      if (app.convertedAt || app.stepStatus === AdmissionStepStatus.CONVERTED || app.primaryStudent) {
        throw new ConflictException(`Idempotency Collision: Application candidate [${app.crmNo}] already linked to an active student profile.`);
      }
      if (app.status !== ApplicationStatus.APPROVED || !app.sectionId) {
        throw new BadRequestException('Enrollment Blocked: Candidate must pass an APPROVED seat allocation window first.');
      }

      await tx.$executeRaw`
        SELECT id FROM "Section" WHERE id = ${app.sectionId} AND "tenantId" = ${tenantId} AND "branchId" = ${branchId} FOR UPDATE;
      `;

      const rollConflict = await tx.student.findFirst({
        where: { tenantId, branchId, sectionId: app.sectionId, academicYear: app.academicYear, rollNumber: rollNumber.trim(), isActive: true }
      });
      if (rollConflict) {
        throw new ConflictException(`Roll Number [${rollNumber}] target section environment mein pehle se assigned hai lala!`);
      }

      const deterministicAdmissionNumber = this.generateAdmissionNumber(app.crmNo); 
      const newStudent = await tx.student.create({
        data: {
          tenantId,
          branchId,
          classId:                app.applyingClassId!, 
          sectionId:              app.sectionId,
          academicYear:           app.academicYear, 
          admissionNumber:        deterministicAdmissionNumber, 
          firstName:              app.firstName.trim(),
          lastName:               app.lastName ? app.lastName.trim() : '',
          dateOfBirth:            app.dob, 
          gender:                 app.gender,
          phone:                  app.phone || null,
          email:                  app.email || null,
          rollNumber:             rollNumber.trim(),
          status:                 StudentStatus.ENROLLED, 
          isActive:               true,
        }
      });

      await tx.admissionApplication.update({
        where: { id: applicationId },
        data: { 
          convertedAt: new Date(),
          studentId:   newStudent.id,
          stepStatus:  AdmissionStepStatus.CONVERTED, 
          updatedById: actorId
        }
      });

      return newStudent;
    }, { timeout: 20000 });
  }
}
