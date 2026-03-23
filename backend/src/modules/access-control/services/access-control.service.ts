import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infra/database/prisma.service';
import {
  CreatePermissionDto,
  GrantRolePermissionDto,
  BulkGrantPermissionsDto,
  GrantUserPermissionDto,
} from '../dto/access-control.dto';

@Injectable()
export class AccessControlService {
  private readonly logger = new Logger(AccessControlService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ========== PERMISSION CRUD ==========

  async createPermission(dto: CreatePermissionDto) {
    const existing = await this.prisma.permission.findUnique({
      where: { module_action: { module: dto.module, action: dto.action } },
    });

    if (existing) {
      throw new ConflictException(`Permission ${dto.module}:${dto.action} already exists`);
    }

    return this.prisma.permission.create({
      data: {
        module: dto.module,
        action: dto.action,
        description: dto.description,
      },
    });
  }

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }

  async getPermissionsByModule() {
    const permissions = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    // Group by module
    const grouped: Record<string, typeof permissions> = {};
    for (const p of permissions) {
      if (!grouped[p.module]) grouped[p.module] = [];
      grouped[p.module].push(p);
    }

    return Object.entries(grouped).map(([module, perms]) => ({
      module,
      permissions: perms,
    }));
  }

  // ========== ROLE PERMISSIONS ==========

  async grantRolePermission(tenantId: string, dto: GrantRolePermissionDto, grantedBy: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id: dto.permissionId },
    });

    if (!permission) {
      throw new NotFoundException(`Permission not found: ${dto.permissionId}`);
    }

    return this.prisma.rolePermission.upsert({
      where: {
        tenantId_role_permissionId: {
          tenantId,
          role: dto.role as any,
          permissionId: dto.permissionId,
        },
      },
      create: {
        tenantId,
        role: dto.role as any,
        permissionId: dto.permissionId,
        grantedBy,
      },
      update: {
        grantedBy,
        grantedAt: new Date(),
      },
    });
  }

  async bulkGrantRolePermissions(tenantId: string, dto: BulkGrantPermissionsDto, grantedBy: string) {
    const results = await Promise.all(
      dto.permissionIds.map((permissionId) =>
        this.grantRolePermission(tenantId, { role: dto.role, permissionId }, grantedBy).catch(
          (e) => ({ error: e.message, permissionId }),
        ),
      ),
    );

    return {
      success: results.filter((r: any) => !('error' in r)).length,
      failed: results.filter((r: any) => 'error' in r),
    };
  }

  async revokeRolePermission(tenantId: string, role: string, permissionId: string) {
    await this.prisma.rolePermission.deleteMany({
      where: { tenantId, role: role as any, permissionId },
    });
    return { success: true };
  }

  async getRolePermissions(tenantId: string, role: string) {
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: { tenantId, role: role as any },
      include: { permission: true },
    });

    return rolePerms.map((rp: any) => rp.permission);
  }

  async getAllRolesPermissions(tenantId: string) {
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: { tenantId },
      include: { permission: true },
    });

    // Group by role
    const grouped: Record<string, any[]> = {};
    for (const rp of rolePerms) {
      if (!grouped[rp.role]) grouped[rp.role] = [];
      grouped[rp.role].push(rp.permission);
    }

    return Object.entries(grouped).map(([role, permissions]) => ({
      role,
      permissions,
    }));
  }

  // ========== USER PERMISSIONS (Overrides) ==========

  async grantUserPermission(tenantId: string, dto: GrantUserPermissionDto, grantedBy: string) {
    return this.prisma.userPermission.upsert({
      where: {
        tenantId_userId_permissionId: {
          tenantId,
          userId: dto.userId,
          permissionId: dto.permissionId,
        },
      },
      create: {
        tenantId,
        userId: dto.userId,
        permissionId: dto.permissionId,
        granted: dto.granted ?? true,
        grantedBy,
      },
      update: {
        granted: dto.granted ?? true,
        grantedBy,
        grantedAt: new Date(),
      },
    });
  }

  async revokeUserPermission(tenantId: string, userId: string, permissionId: string) {
    await this.prisma.userPermission.deleteMany({
      where: { tenantId, userId, permissionId },
    });
    return { success: true };
  }

  async getUserPermissions(tenantId: string, userId: string) {
    return this.prisma.userPermission.findMany({
      where: { tenantId, userId },
    });
  }

  // ========== CHECK PERMISSION ==========

  async checkPermission(
    tenantId: string,
    userId: string,
    userRole: string,
    module: string,
    action: string,
  ): Promise<boolean> {
    // 1. Find the permission
    const permission = await this.prisma.permission.findUnique({
      where: { module_action: { module, action } },
    });

    if (!permission) {
      this.logger.warn(`Permission not found: ${module}:${action}`);
      return false;
    }

    // 2. Check user-level override first
    const userOverride = await this.prisma.userPermission.findUnique({
      where: {
        tenantId_userId_permissionId: {
          tenantId,
          userId,
          permissionId: permission.id,
        },
      },
    });

    if (userOverride) {
      return userOverride.granted;
    }

    // 3. Check role-level permission
    const rolePermission = await this.prisma.rolePermission.findUnique({
      where: {
        tenantId_role_permissionId: {
          tenantId,
          role: userRole as any,
          permissionId: permission.id,
        },
      },
    });

    return !!rolePermission;
  }

  // ========== SEED DEFAULT PERMISSIONS ==========

  async seedDefaultPermissions() {
    const modules = [
      // Core academics
      { module: 'students',       actions: ['create','read','update','delete','export','import','promote','transfer'] },
      { module: 'academics',      actions: ['create','read','update','delete','manage_classes','manage_sections','manage_subjects','assign_class_teacher'] },
      { module: 'attendance',     actions: ['mark','read','update','delete','reports','mark_own_section'] },
      { module: 'timetable',      actions: ['create','read','update','delete','view_own_section'] },
      { module: 'exams',          actions: ['create','read','update','delete','enter_marks','publish_results','view_own_section'] },
      { module: 'gradebook',      actions: ['create','read','update','delete','enter_marks','publish'] },
      { module: 'homework',       actions: ['create','read','update','delete','submit','grade'] },
      { module: 'admissions',     actions: ['create','read','update','approve','reject','promote','generate_id','export'] },
      { module: 'certificates',   actions: ['create','read','issue','revoke'] },
      // Finance
      { module: 'billing',        actions: ['create','read','update','delete','approve_discount','generate_receipt','export','send_reminder','record_payment'] },
      { module: 'accounting',     actions: ['create','read','update','delete','approve','export'] },
      { module: 'payroll',        actions: ['create','read','update','delete','process','approve'] },
      // Staff & HR
      { module: 'staff',          actions: ['create','read','update','delete','view_own'] },
      { module: 'hr',             actions: ['create','read','update','delete','approve_joining','approve_leave','reject_leave','process_payroll','view_own_leaves'] },
      // Operations
      { module: 'library',        actions: ['create','read','update','delete','issue','return','view_catalog'] },
      { module: 'transport',      actions: ['create','read','update','delete','assign','track'] },
      { module: 'inventory',      actions: ['create','read','update','delete','issue','request'] },
      { module: 'reception',      actions: ['create_complaint','read_complaint','update_complaint','resolve_complaint','manage_visitor','read_own_complaints'] },
      { module: 'communication',  actions: ['create','read','send','delete','manage_announcements','read_announcements'] },
      // Admin
      { module: 'reports',        actions: ['view','export','view_own_section'] },
      { module: 'settings',       actions: ['read','update','manage_branches'] },
      { module: 'access_control', actions: ['read','manage'] },
    ];

    let created = 0;
    for (const m of modules) {
      for (const action of m.actions) {
        try {
          await this.prisma.permission.upsert({
            where:  { module_action: { module: m.module, action } },
            create: { module: m.module, action, description: `${action} ${m.module}`.replace(/_/g,' ') },
            update: {},
          });
          created++;
        } catch { /* skip duplicates */ }
      }
    }
    return { created };
  }

  // ── Apply the default permission matrix for every role ──────────────────
  async applyDefaultMatrix(tenantId: string, grantedBy: string) {
    // Define what each role can do by default
    // Format: { role: [ 'module:action', ... ] }
    const matrix: Record<string, string[]> = {
      SCHOOL_ADMIN: [
        'students:create','students:read','students:update','students:delete','students:export','students:import','students:promote','students:transfer',
        'academics:create','academics:read','academics:update','academics:delete','academics:manage_classes','academics:manage_sections','academics:manage_subjects','academics:assign_class_teacher',
        'attendance:mark','attendance:read','attendance:update','attendance:reports',
        'timetable:create','timetable:read','timetable:update','timetable:delete',
        'exams:create','exams:read','exams:update','exams:delete','exams:enter_marks','exams:publish_results',
        'gradebook:create','gradebook:read','gradebook:update','gradebook:delete','gradebook:enter_marks','gradebook:publish',
        'homework:create','homework:read','homework:update','homework:delete','homework:grade',
        'admissions:create','admissions:read','admissions:update','admissions:approve','admissions:reject','admissions:promote','admissions:generate_id','admissions:export',
        'billing:create','billing:read','billing:update','billing:delete','billing:approve_discount','billing:generate_receipt','billing:export','billing:send_reminder','billing:record_payment',
        'accounting:create','accounting:read','accounting:update','accounting:delete','accounting:approve','accounting:export',
        'payroll:create','payroll:read','payroll:update','payroll:process','payroll:approve',
        'staff:create','staff:read','staff:update','staff:delete',
        'hr:create','hr:read','hr:update','hr:delete','hr:approve_joining','hr:approve_leave','hr:reject_leave','hr:process_payroll',
        'library:create','library:read','library:update','library:delete','library:issue','library:return',
        'transport:create','transport:read','transport:update','transport:delete','transport:assign',
        'inventory:create','inventory:read','inventory:update','inventory:delete','inventory:issue',
        'reception:create_complaint','reception:read_complaint','reception:update_complaint','reception:resolve_complaint','reception:manage_visitor',
        'communication:create','communication:read','communication:send','communication:delete','communication:manage_announcements',
        'certificates:create','certificates:read','certificates:issue','certificates:revoke',
        'reports:view','reports:export',
        'settings:read','settings:update',
        'access_control:read','access_control:manage',
      ],

      PRINCIPAL: [
        'students:create','students:read','students:update','students:export','students:promote',
        'academics:create','academics:read','academics:update','academics:manage_classes','academics:manage_sections','academics:manage_subjects','academics:assign_class_teacher',
        'attendance:mark','attendance:read','attendance:update','attendance:reports',
        'timetable:create','timetable:read','timetable:update','timetable:delete',
        'exams:create','exams:read','exams:update','exams:publish_results',
        'gradebook:read','gradebook:publish',
        'homework:create','homework:read','homework:update',
        'admissions:create','admissions:read','admissions:update','admissions:approve','admissions:reject','admissions:promote',
        'billing:read','billing:approve_discount',
        'staff:create','staff:read','staff:update',
        'hr:read','hr:approve_joining','hr:approve_leave','hr:reject_leave',
        'library:read','transport:read',
        'reception:read_complaint','reception:resolve_complaint',
        'communication:create','communication:read','communication:send','communication:manage_announcements',
        'certificates:create','certificates:read','certificates:issue',
        'reports:view','reports:export',
        'settings:read',
        'access_control:read',
      ],

      VICE_PRINCIPAL: [
        'students:read','students:update',
        'academics:read','academics:update','academics:manage_classes','academics:manage_sections','academics:assign_class_teacher',
        'attendance:mark','attendance:read','attendance:update','attendance:reports',
        'timetable:create','timetable:read','timetable:update',
        'exams:create','exams:read','exams:update',
        'gradebook:read',
        'homework:read',
        'staff:read',
        'hr:read','hr:approve_leave','hr:reject_leave',
        'communication:read','communication:send','communication:manage_announcements',
        'reports:view',
        'settings:read',
      ],

      CLASS_TEACHER: [
        'students:read','students:update',
        'academics:read',
        'attendance:mark_own_section','attendance:read','attendance:reports',
        'timetable:view_own_section','timetable:read',
        'exams:read','exams:enter_marks','exams:view_own_section',
        'gradebook:read','gradebook:enter_marks',
        'homework:create','homework:read','homework:update','homework:grade',
        'communication:read','communication:send','communication:read_announcements',
        'reports:view_own_section',
        'hr:view_own_leaves',
      ],

      TEACHER: [
        'students:read',
        'academics:read',
        'attendance:read',
        'timetable:view_own_section','timetable:read',
        'exams:read','exams:enter_marks','exams:view_own_section',
        'gradebook:read','gradebook:enter_marks',
        'homework:create','homework:read','homework:update','homework:grade',
        'communication:read','communication:read_announcements',
        'reports:view_own_section',
        'hr:view_own_leaves',
      ],

      ACCOUNTANT: [
        'students:read',
        'billing:create','billing:read','billing:update','billing:generate_receipt','billing:export','billing:send_reminder','billing:record_payment',
        'accounting:create','accounting:read','accounting:update','accounting:export',
        'payroll:read','payroll:process',
        'reports:view','reports:export',
        'communication:read','communication:read_announcements',
      ],

      LIBRARIAN: [
        'students:read',
        'library:create','library:read','library:update','library:delete','library:issue','library:return','library:view_catalog',
        'communication:read','communication:read_announcements',
        'reports:view_own_section',
      ],

      RECEPTIONIST: [
        'students:read',
        'admissions:create','admissions:read',
        'reception:create_complaint','reception:read_complaint','reception:update_complaint','reception:manage_visitor',
        'communication:read','communication:read_announcements',
      ],

      HR_MANAGER: [
        'staff:create','staff:read','staff:update',
        'hr:create','hr:read','hr:update','hr:approve_joining','hr:approve_leave','hr:reject_leave','hr:process_payroll',
        'payroll:create','payroll:read','payroll:update','payroll:process',
        'reports:view',
        'communication:read','communication:read_announcements',
      ],

      TRANSPORT_MANAGER: [
        'students:read',
        'transport:create','transport:read','transport:update','transport:delete','transport:assign','transport:track',
        'communication:read','communication:read_announcements',
      ],

      NURSE: [
        'students:read',
        'communication:read','communication:read_announcements',
      ],

      STAFF: [
        'communication:read','communication:read_announcements',
      ],
    };

    let granted = 0;
    let skipped = 0;

    for (const [role, actions] of Object.entries(matrix)) {
      for (const moduleAction of actions) {
        const [module, action] = moduleAction.split(':');
        try {
          const permission = await this.prisma.permission.findUnique({
            where: { module_action: { module, action } },
          });
          if (!permission) { skipped++; continue; }

          await this.prisma.rolePermission.upsert({
            where:  { tenantId_role_permissionId: { tenantId, role: role as any, permissionId: permission.id } },
            create: { tenantId, role: role as any, permissionId: permission.id, grantedBy },
            update: { grantedBy, grantedAt: new Date() },
          });
          granted++;
        } catch { skipped++; }
      }
    }

    return { granted, skipped, roles: Object.keys(matrix).length };
  }
}
