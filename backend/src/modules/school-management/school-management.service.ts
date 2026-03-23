import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../infra/database/prisma.service';
import { AuditService }  from '../../core/compliance/audit.service';
import {
  UpdateSchoolProfileDto,
  CreateBranchDto, UpdateBranchDto,
  InviteUserDto, UpdateUserRoleDto,
  CreateClassDto, CreateSectionDto, UpdateSectionDto, CreateSubjectDto,
  CreateFeeTypeDto, CreateFeeStructureDto,
  CreateRouteDto, CreateVehicleDto,
  UpdateBrandingDto, UpdateSecuritySettingsDto,
} from './school-management.dto';

@Injectable()
export class SchoolManagementService {
  private readonly logger = new Logger(SchoolManagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  private async resolveTenant(tenantId: string) {
    const t = await this.prisma.tenant.findFirst({ where: { id: tenantId } });
    if (!t) throw new NotFoundException(`Tenant not found: ${tenantId}`);
    return t;
  }

  // ── 1. Profile ──────────────────────────────────────────────────────────────

  async getProfile(tenantId: string) { return this.resolveTenant(tenantId); }

  async updateProfile(tenantId: string, dto: UpdateSchoolProfileDto, actorId: string) {
    const before = await this.resolveTenant(tenantId);
    const updated = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.name               && { name:               dto.name               }),
        ...(dto.shortName          && { shortName:          dto.shortName          }),
        ...(dto.phone              && { phone:              dto.phone              }),
        ...(dto.email              && { email:              dto.email              }),
        ...(dto.website            && { website:            dto.website            }),
        ...(dto.address            && { address:            dto.address            }),
        ...(dto.city               && { city:               dto.city               }),
        ...(dto.state              && { state:              dto.state              }),
        ...(dto.pincode            && { pincode:            dto.pincode            }),
        ...(dto.country            && { country:            dto.country            }),
        ...(dto.board              && { board:              dto.board              }),
        ...(dto.registrationNumber && { registrationNumber: dto.registrationNumber }),
        ...(dto.gstin              && { gstin:              dto.gstin              }),
        ...(dto.timezone           && { timezone:           dto.timezone           }),
        ...(dto.currency           && { currency:           dto.currency as any    }),
      },
    });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'Tenant', entityId: tenantId, before: { name: before.name }, after: dto });
    return updated;
  }

  // ── 2. Branches ─────────────────────────────────────────────────────────────

  async getBranches(tenantId: string) {
    return this.prisma.branch.findMany({ where: { tenantId }, orderBy: { name: 'asc' } });
  }

  async createBranch(tenantId: string, dto: CreateBranchDto, actorId: string) {
    const existing = await this.prisma.branch.findFirst({ where: { tenantId, name: dto.name } });
    if (existing) throw new ConflictException(`Branch "${dto.name}" already exists.`);

    const branch = await this.prisma.branch.create({
      // Schema field is `branchCode`, not `code`
      data: {
        tenantId,
        name:       dto.name,
        branchCode: dto.code      ?? null,
        address:    dto.address   ?? null,
        city:       dto.city      ?? null,
        phone:      dto.phone     ?? null,
        email:      dto.email     ?? null,
        principal:  dto.principal ?? null,
        isActive:   true,
      },
    });
    await this.audit.logCreate({ tenantId, actorId, entityType: 'Branch', entityId: branch.id, after: { name: branch.name } });
    return branch;
  }

  async updateBranch(tenantId: string, id: string, dto: UpdateBranchDto, actorId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId } });
    if (!branch) throw new NotFoundException(`Branch not found: ${id}`);

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name      !== undefined && { name:       dto.name      }),
        // Schema field is `branchCode`, not `code`
        ...(dto.code      !== undefined && { branchCode: dto.code      }),
        ...(dto.address   !== undefined && { address:    dto.address   }),
        ...(dto.city      !== undefined && { city:       dto.city      }),
        ...(dto.phone     !== undefined && { phone:      dto.phone     }),
        ...(dto.email     !== undefined && { email:      dto.email     }),
        ...(dto.principal !== undefined && { principal:  dto.principal }),
        ...(dto.isActive  !== undefined && { isActive:   dto.isActive  }),
      },
    });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'Branch', entityId: id, before: { name: branch.name }, after: dto });
    return updated;
  }

  async deleteBranch(tenantId: string, id: string, actorId: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id, tenantId } });
    if (!branch) throw new NotFoundException(`Branch not found: ${id}`);
    await this.prisma.branch.update({ where: { id }, data: { isActive: false } });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'Branch', entityId: id, before: { isActive: true }, after: { isActive: false } });
    return { success: true };
  }

  // ── 3. Users ────────────────────────────────────────────────────────────────

  async getUsers(tenantId: string, filters: { role?: string; isActive?: boolean; search?: string } = {}) {
    const where: any = { tenantId };
    if (filters.role)     where.role     = filters.role;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName:  { contains: filters.search, mode: 'insensitive' } },
        { email:     { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, createdAt: true },
      orderBy: [{ role: 'asc' }, { firstName: 'asc' }],
    });
  }

  async inviteUser(tenantId: string, dto: InviteUserDto, actorId: string) {
    const existing = await this.prisma.user.findFirst({ where: { tenantId, email: dto.email } });
    if (existing) throw new ConflictException(`User "${dto.email}" already exists.`);
    const user = await this.prisma.user.create({
      data: { tenantId, email: dto.email, firstName: dto.firstName, lastName: dto.lastName, role: dto.role as any, isActive: true },
      select: { id: true, email: true, firstName: true, lastName: true, role: true },
    });
    await this.audit.logCreate({ tenantId, actorId, entityType: 'User', entityId: user.id, after: { email: user.email, role: user.role } });
    this.logger.log(`User invited: ${dto.email} as ${dto.role} | tenant: ${tenantId}`);
    return user;
  }

  async updateUserRole(tenantId: string, userId: string, dto: UpdateUserRoleDto, actorId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException(`User not found: ${userId}`);
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { role: dto.role as any, ...(dto.isActive !== undefined && { isActive: dto.isActive }) },
      select: { id: true, email: true, role: true, isActive: true },
    });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'User', entityId: userId, before: { role: user.role }, after: { role: dto.role } });
    return updated;
  }

  async removeUser(tenantId: string, userId: string, actorId: string) {
    if (userId === actorId) throw new ConflictException('You cannot remove yourself.');
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) throw new NotFoundException(`User not found: ${userId}`);
    await this.prisma.user.update({ where: { id: userId }, data: { isActive: false } });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'User', entityId: userId, before: { isActive: true }, after: { isActive: false } });
    return { success: true };
  }

  // ── 4. Academics ────────────────────────────────────────────────────────────

  async getAcademicStructure(tenantId: string) {
    const [classes, subjects] = await Promise.all([
      this.prisma.class.findMany({ where: { tenantId }, include: { sections: { orderBy: { name: 'asc' } } }, orderBy: { displayOrder: 'asc' } }),
      this.prisma.subject.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
    ]);
    return { classes, subjects };
  }

  async createClass(tenantId: string, dto: CreateClassDto, actorId: string) {
    const existing = await this.prisma.class.findFirst({ where: { tenantId, name: dto.name } });
    if (existing) throw new ConflictException(`Class "${dto.name}" already exists.`);
    const cls = await this.prisma.class.create({ data: { tenantId, name: dto.name, sessionId: '', displayOrder: dto.sortOrder ?? 0 } as any });
    await this.audit.logCreate({ tenantId, actorId, entityType: 'Class', entityId: cls.id, after: { name: cls.name } });
    return cls;
  }

  async createSection(tenantId: string, dto: CreateSectionDto, actorId: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: dto.classId, tenantId } });
    if (!cls) throw new NotFoundException(`Class not found: ${dto.classId}`);
    const existing = await this.prisma.section.findFirst({ where: { classId: dto.classId, name: dto.name } });
    if (existing) throw new ConflictException(`Section "${dto.name}" already exists in this class.`);
    const section = await this.prisma.section.create({
      data: { classId: dto.classId, tenantId, name: dto.name, classTeacherId: dto.classTeacherId ?? null, capacity: dto.capacity ?? undefined, isActive: true },
      include: { class: true },
    });
    await this.audit.logCreate({ tenantId, actorId, entityType: 'Section', entityId: section.id, after: { name: section.name, classId: dto.classId } });
    return section;
  }

  async updateSection(tenantId: string, id: string, dto: UpdateSectionDto, actorId: string) {
    const section = await this.prisma.section.findFirst({ where: { id, class: { tenantId } } });
    if (!section) throw new NotFoundException(`Section not found: ${id}`);
    const updated = await this.prisma.section.update({
      where: { id },
      data: {
        ...(dto.name           !== undefined && { name:           dto.name           }),
        ...(dto.classTeacherId !== undefined && { classTeacherId: dto.classTeacherId }),
        ...(dto.capacity       !== undefined && { capacity:       dto.capacity       }),
        ...(dto.isActive       !== undefined && { isActive:       dto.isActive       }),
      },
    });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'Section', entityId: id, before: { name: section.name }, after: dto });
    return updated;
  }

  async createSubject(tenantId: string, dto: CreateSubjectDto, actorId: string) {
    const existing = await this.prisma.subject.findFirst({ where: { tenantId, name: dto.name } });
    if (existing) throw new ConflictException(`Subject "${dto.name}" already exists.`);
    const subject = await this.prisma.subject.create({ data: { tenantId, name: dto.name, code: dto.code ?? null, description: dto.description ?? null } });
    await this.audit.logCreate({ tenantId, actorId, entityType: 'Subject', entityId: subject.id, after: { name: subject.name } });
    return subject;
  }

  // ── 5. Fee Setup ────────────────────────────────────────────────────────────

  async getFeeSetup(tenantId: string) {
    const [feeTypes, feeStructures] = await Promise.all([
      this.prisma.feeType.findMany({ where: { tenantId }, orderBy: { name: 'asc' } }),
      this.prisma.feeStructure.findMany({ where: { tenantId }, include: { class: true, feeType: true }, orderBy: { name: 'asc' } }),
    ]);
    return { feeTypes, feeStructures };
  }

  async createFeeType(tenantId: string, dto: CreateFeeTypeDto, actorId: string) {
    const existing = await this.prisma.feeType.findFirst({ where: { tenantId, name: dto.name } });
    if (existing) throw new ConflictException(`Fee type "${dto.name}" already exists.`);
    const feeType = await this.prisma.feeType.create({
      data: { tenantId, name: dto.name, description: dto.description ?? null, isMandatory: dto.isMandatory ?? false, isRecurring: dto.isRecurring ?? true },
    });
    await this.audit.logCreate({ tenantId, actorId, entityType: 'FeeType', entityId: feeType.id, after: { name: feeType.name } });
    return feeType;
  }

  async createFeeStructure(tenantId: string, dto: CreateFeeStructureDto, actorId: string) {
    const cls = await this.prisma.class.findFirst({ where: { id: dto.classId, tenantId } });
    if (!cls) throw new NotFoundException(`Class not found: ${dto.classId}`);
    const structure = await this.prisma.feeStructure.create({
      data: { tenantId, name: dto.name, classId: dto.classId, frequency: dto.frequency as any, amount: dto.amount, feeTypeId: dto.feeTypeId ?? null },
      include: { class: true, feeType: true },
    });
    await this.audit.logCreate({ tenantId, actorId, entityType: 'FeeStructure', entityId: structure.id, after: { name: structure.name, amount: structure.amount } });
    return structure;
  }

  async deleteFeeStructure(tenantId: string, id: string, actorId: string) {
    const s = await this.prisma.feeStructure.findFirst({ where: { id, tenantId } });
    if (!s) throw new NotFoundException(`Fee structure not found: ${id}`);
    await this.prisma.feeStructure.delete({ where: { id } });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'FeeStructure', entityId: id, before: { name: s.name }, after: { deleted: true } });
    return { success: true };
  }

  // ── 6. Transport ────────────────────────────────────────────────────────────

  async getTransportSetup(tenantId: string) {
    const routes = await this.prisma.transportRoute.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });
    return { routes, vehicles: [] };
  }

  async createRoute(tenantId: string, dto: CreateRouteDto, actorId: string) {
    const existing = await this.prisma.transportRoute.findFirst({ where: { tenantId, name: dto.name } });
    if (existing) throw new ConflictException(`Route "${dto.name}" already exists.`);
    const route = await this.prisma.transportRoute.create({ data: { tenantId, name: dto.name, description: dto.description ?? undefined, feeAmount: dto.feeAmount ?? 0 } });
    await this.audit.logCreate({ tenantId, actorId, entityType: 'TransportRoute', entityId: route.id, after: { name: route.name } });
    return route;
  }

  async createVehicle(tenantId: string, dto: CreateVehicleDto, actorId: string) {
    const existing = await this.prisma.transportRoute.findFirst({ where: { tenantId, vehicleNumber: dto.registrationNumber } });
    if (existing) throw new ConflictException(`Vehicle "${dto.registrationNumber}" already exists.`);
    const vehicle = await this.prisma.transportRoute.create({
      data: { tenantId, name: dto.registrationNumber, vehicleNumber: dto.registrationNumber, driverName: dto.driverName ?? undefined, driverPhone: dto.driverPhone ?? undefined },
    });
    await this.audit.logCreate({ tenantId, actorId, entityType: 'Vehicle', entityId: vehicle.id, after: { vehicleNumber: vehicle.vehicleNumber } });
    return vehicle;
  }

  // ── 7. Branding ─────────────────────────────────────────────────────────────

  async getBranding(tenantId: string) {
    const b = await this.prisma.tenantBranding.findFirst({ where: { tenantId } });
    return b ?? { tenantId, primaryColor: '#1E40AF', secondaryColor: '#DBEAFE' };
  }

  async updateBranding(tenantId: string, dto: UpdateBrandingDto, actorId: string) {
    const updated = await this.prisma.tenantBranding.upsert({
      where:  { tenantId },
      create: { tenantId, ...dto },
      update: {
        ...(dto.primaryColor   !== undefined && { primaryColor:   dto.primaryColor   }),
        ...(dto.secondaryColor !== undefined && { secondaryColor: dto.secondaryColor }),
        ...(dto.logoUrl        !== undefined && { logoUrl:        dto.logoUrl        }),
        ...(dto.faviconUrl     !== undefined && { faviconUrl:     dto.faviconUrl     }),
        ...(dto.portalTitle    !== undefined && { portalTitle:    dto.portalTitle    }),
        ...(dto.tagline        !== undefined && { tagline:        dto.tagline        }),
      },
    });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'TenantBranding', entityId: tenantId, before: {}, after: dto });
    return updated;
  }

  // ── 8. Security ─────────────────────────────────────────────────────────────

  async getSecuritySettings(tenantId: string) {
    const s = await this.prisma.tenantSecuritySettings.findFirst({ where: { tenantId } });
    return s ?? { tenantId, sessionTimeoutMinutes: 60, requireMfaForAdmins: false, maxLoginAttempts: 5, allowedIpRanges: [], enforcePasswordPolicy: false, passwordExpiryDays: 90 };
  }

  async updateSecuritySettings(tenantId: string, dto: UpdateSecuritySettingsDto, actorId: string) {
    const updated = await this.prisma.tenantSecuritySettings.upsert({
      where:  { tenantId },
      create: { tenantId, ...dto },
      update: {
        ...(dto.sessionTimeoutMinutes  !== undefined && { sessionTimeoutMinutes:  dto.sessionTimeoutMinutes  }),
        ...(dto.requireMfaForAdmins    !== undefined && { requireMfaForAdmins:    dto.requireMfaForAdmins    }),
        ...(dto.maxLoginAttempts       !== undefined && { maxLoginAttempts:        dto.maxLoginAttempts       }),
        ...(dto.allowedIpRanges        !== undefined && { allowedIpRanges:         dto.allowedIpRanges        }),
        ...(dto.enforcePasswordPolicy  !== undefined && { enforcePasswordPolicy:   dto.enforcePasswordPolicy  }),
        ...(dto.passwordExpiryDays     !== undefined && { passwordExpiryDays:      dto.passwordExpiryDays     }),
      },
    });
    await this.audit.logUpdate({ tenantId, actorId, entityType: 'TenantSecuritySettings', entityId: tenantId, before: {}, after: dto });
    return updated;
  }

  // ── Overview ────────────────────────────────────────────────────────────────

  async getOverview(tenantId: string) {
    const [profile, branches, users, classes, routes] = await Promise.all([
      this.prisma.tenant.findFirst({ where: { id: tenantId } }),
      this.prisma.branch.count({ where: { tenantId, isActive: true } }),
      this.prisma.user.count({ where: { tenantId, isActive: true } }),
      this.prisma.class.count({ where: { tenantId } }),
      this.prisma.transportRoute.count({ where: { tenantId } }),
    ]);
    return { profile, stats: { branches, users, classes, routes } };
  }
}
