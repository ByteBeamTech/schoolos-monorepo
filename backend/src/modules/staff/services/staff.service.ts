import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService }  from '../../../core/compliance/audit.service';
import { CreateStaffDto, UpdateStaffDto } from '../dto/staff.dto';

@Injectable()
export class StaffService {
  private readonly logger = new Logger(StaffService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  async create(tenantId: string, dto: CreateStaffDto, actorId: string) {
    const existing = await this.prisma.staffProfile.findFirst({
      where: { tenantId, employeeId: dto.employeeId },
    });
    if (existing) {
      throw new ConflictException(
        `Employee ID "${dto.employeeId}" already exists.`,
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: dto.userId, tenantId },
    });
    if (!user) throw new NotFoundException(`User not found: ${dto.userId}`);

    const userAlreadyStaff = await this.prisma.staffProfile.findUnique({
      where: { userId: dto.userId },
    });
    if (userAlreadyStaff) {
      throw new ConflictException('User already has a staff profile.');
    }

    const staff = await this.prisma.staffProfile.create({
      data: {
        tenantId,
        userId:        dto.userId,
        employeeId:    dto.employeeId,
        designation:   dto.designation,
        department:    dto.department    ?? null,
        dateOfJoining: new Date(dto.dateOfJoining),
        dateOfBirth:   dto.dateOfBirth   ? new Date(dto.dateOfBirth) : null,
        qualification: dto.qualification ?? null,
        experience:    dto.experience    ?? null,
        isActive:      true,
      },
      include: { user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } } },
    });

    await this.audit.logCreate({
      tenantId, actorId,
      entityType: 'StaffProfile', entityId: staff.id,
      after: { employeeId: staff.employeeId, designation: staff.designation },
    });

    this.logger.log(`Staff created: ${staff.employeeId} | tenant: ${tenantId}`);
    return staff;
  }

  async findAll(tenantId: string, filters: {
    department?: string;
    isActive?:   boolean;
    search?:     string;
  } = {}) {
    const where: any = { tenantId };
    if (filters.department) where.department = filters.department;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const staff = await this.prisma.staffProfile.findMany({
      where,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true },
        },
      },
      orderBy: { user: { firstName: 'asc' } },
    });

    if (filters.search) {
      const s = filters.search.toLowerCase();
      return staff.filter((st: any) =>
        st.user.firstName.toLowerCase().includes(s) ||
        st.user.lastName.toLowerCase().includes(s) ||
        st.employeeId.toLowerCase().includes(s) ||
        st.designation.toLowerCase().includes(s),
      );
    }

    return staff;
  }

  async findById(tenantId: string, id: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where:   { id, tenantId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true, phone: true } },
      },
    });
    if (!staff) throw new NotFoundException(`Staff not found: ${id}`);
    return staff;
  }

  async findByUserId(tenantId: string, userId: string) {
    const staff = await this.prisma.staffProfile.findFirst({
      where:   { userId, tenantId },
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });
    if (!staff) throw new NotFoundException(`Staff profile not found for user: ${userId}`);
    return staff;
  }

  async update(
    tenantId: string, id: string,
    dto: UpdateStaffDto, actorId: string,
  ) {
    const staff = await this.findById(tenantId, id);
    const updated = await this.prisma.staffProfile.update({
      where: { id },
      data:  dto,
      include: {
        user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      },
    });

    await this.audit.logUpdate({
      tenantId, actorId,
      entityType: 'StaffProfile', entityId: id,
      before: { designation: staff.designation, department: staff.department },
      after:  dto,
    });

    return updated;
  }
}
