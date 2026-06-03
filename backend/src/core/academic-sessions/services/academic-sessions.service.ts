import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../compliance/audit.service';
import {
  CreateAcademicSessionDto,
  UpdateAcademicSessionDto,
} from '../dto/academic-session.dto';

@Injectable()
export class AcademicSessionsService {
  private readonly logger = new Logger(AcademicSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit:  AuditService,
  ) {}

  // ── Create ────────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    dto:      CreateAcademicSessionDto,
    actorId:  string,
  ) {
    const existing = await this.prisma.academicSession.findFirst({
      where: { tenantId, name: dto.name },
    });
    if (existing) {
      throw new ConflictException(
        `Academic session "${dto.name}" already exists.`,
      );
    }

    if (new Date(dto.startDate) >= new Date(dto.endDate)) {
      throw new BadRequestException('Start date must be before end date.');
    }

    // If setting as current, unset any existing current session
    if (dto.isCurrent) {
      await this.prisma.academicSession.updateMany({
        where: { tenantId, isCurrent: true },
        data:  { isCurrent: false },
      });
    }

    const session = await this.prisma.academicSession.create({
      data: {
        tenantId,
        name:      dto.name,
        startDate: new Date(dto.startDate),
        endDate:   new Date(dto.endDate),
        isCurrent: dto.isCurrent ?? false,
      },
    });

    if (
  dto.copyClasses ||
  dto.copySections ||
  dto.copySubjects
) {
  await this.copyStructure(
    tenantId,
    session.id,
    dto,
  );
}

    await this.audit.logCreate({
      tenantId, actorId,
      entityType: 'AcademicSession',
      entityId:   session.id,
      after:      session,
    });

    this.logger.log(`Session created: ${session.name} | tenant: ${tenantId}`);
    return session;
  }

  // ── Find all ──────────────────────────────────────────────────────────────

  async findAll(tenantId: string) {
    return this.prisma.academicSession.findMany({
      where:   { tenantId },
      orderBy: { startDate: 'desc' },
    });
  }

  // ── Find current ──────────────────────────────────────────────────────────

  async findCurrent(tenantId: string) {
    const session = await this.prisma.academicSession.findFirst({
      where: { tenantId, isCurrent: true },
    });
    if (!session) {
      throw new NotFoundException(
        'No active academic session found. Please set one as current.',
      );
    }
    return session;
  }

  // ── Find by id ────────────────────────────────────────────────────────────

  async findById(tenantId: string, id: string) {
    const session = await this.prisma.academicSession.findFirst({
      where: { id, tenantId },
    });
    if (!session) throw new NotFoundException(`Session not found: ${id}`);
    return session;
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(
    tenantId: string,
    id:       string,
    dto:      UpdateAcademicSessionDto,
    actorId:  string,
  ) {
    const session = await this.findById(tenantId, id);

    if (session.isLocked) {
      throw new BadRequestException(
        'This academic session is locked and cannot be modified.',
      );
    }

    if (dto.isCurrent) {
      await this.prisma.academicSession.updateMany({
        where: { tenantId, isCurrent: true, id: { not: id } },
        data:  { isCurrent: false },
      });
    }

    const updated = await this.prisma.academicSession.update({
      where: { id },
      data: {
        ...(dto.name      && { name:      dto.name }),
        ...(dto.startDate && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate   && { endDate:   new Date(dto.endDate) }),
        ...(dto.isCurrent !== undefined && { isCurrent: dto.isCurrent }),
      },
    });

    await this.audit.logUpdate({
      tenantId, actorId,
      entityType: 'AcademicSession',
      entityId:   id,
      before:     session,
      after:      updated,
    });

    return updated;
  }

  // ── Set current ───────────────────────────────────────────────────────────

  async setCurrent(tenantId: string, id: string, actorId: string) {
    await this.findById(tenantId, id);

    await this.prisma.academicSession.updateMany({
      where: { tenantId, isCurrent: true },
      data:  { isCurrent: false },
    });

    const updated = await this.prisma.academicSession.update({
      where: { id },
      data:  { isCurrent: true },
    });

    await this.audit.logUpdate({
      tenantId, actorId,
      entityType: 'AcademicSession',
      entityId:   id,
      after:      { isCurrent: true },
    });

    this.logger.log(`Session set as current: ${updated.name}`);
    return updated;
  }

  // ── Lock ──────────────────────────────────────────────────────────────────

  async lock(tenantId: string, id: string, actorId: string) {
    await this.findById(tenantId, id);

    const locked = await this.prisma.academicSession.update({
      where: { id },
      data:  { isLocked: true },
    });

    await this.audit.logUpdate({
      tenantId, actorId,
      entityType: 'AcademicSession',
      entityId:   id,
      after:      { isLocked: true },
    });

    this.logger.log(`Session locked: ${locked.name}`);
    return locked;
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    const [classCount, studentCount] = await Promise.all([
      this.prisma.class.count({ where: { tenantId, sessionId: id } }),
      this.prisma.student.count({ where: { tenantId, academicYear: id } }),
    ]);

    return { classCount, studentCount };
  }

  private async copyStructure(
  tenantId: string,
  targetSessionId: string,
  dto: {
    copyClasses?: boolean;
    copySections?: boolean;
    copySubjects?: boolean;
  },
) {
  const currentSession =
    await this.prisma.academicSession.findFirst({
      where: {
        tenantId,
        isCurrent: true,
      },
    });

  if (!currentSession) {
    return;
  }

  if (dto.copyClasses || dto.copySections) {
    const classes = await this.prisma.class.findMany({
      where: {
        tenantId,
        sessionId: currentSession.id,
      },
      include: {
        sections: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    for (const cls of classes) {
      const newClass = await this.prisma.class.create({
        data: {
          tenantId,
          branchId: cls.branchId,
          sessionId: targetSessionId,
          name: cls.name,
          displayOrder: cls.displayOrder,
          isActive: cls.isActive,
        },
      });

      if (dto.copySections) {
        for (const sec of cls.sections) {
          await this.prisma.section.create({
            data: {
              tenantId,
              branchId: sec.branchId,
              classId: newClass.id,
              name: sec.name,
              capacity: sec.capacity,
              isActive: sec.isActive,
            },
          });
        }
      }
    }
  }

  this.logger.log(
    `Academic structure copied to session ${targetSessionId}`,
  );
}

async unlock(
  tenantId: string,
  id: string,
  actorId: string,
) {
  const session =
    await this.prisma.academicSession.findFirst({
      where: {
        id,
        tenantId,
      },
    });

  if (!session) {
    throw new NotFoundException(
      'Academic session not found',
    );
  }

  const updated =
    await this.prisma.academicSession.update({
      where: { id },
      data: {
        isLocked: false,
      },
    });

  await this.audit.logUpdate({
    tenantId,
    actorId,
    entityType: 'AcademicSession',
    entityId: id,
    before: session,
    after: updated,
  });

  return updated;
}

async readinessCheck(
  tenantId: string,
  targetSessionId: string,
) {
  const currentSession =
    await this.prisma.academicSession.findFirst({
      where: {
        tenantId,
        isCurrent: true,
      },
    });

  if (!currentSession) {
    throw new BadRequestException(
      'No current academic session found',
    );
  }

  const targetSession =
    await this.prisma.academicSession.findFirst({
      where: {
        id: targetSessionId,
        tenantId,
      },
    });

  if (!targetSession) {
    throw new NotFoundException(
      'Target session not found',
    );
  }

  const classes =
    await this.prisma.class.count({
      where: {
        tenantId,
        sessionId: targetSessionId,
      },
    });

  const sections =
    await this.prisma.section.count({
      where: {
        tenantId,
        class: {
          sessionId: targetSessionId,
        },
      },
    });

  const students =
    await this.prisma.student.count({
      where: {
        tenantId,
        isActive: true,
      },
    });

    const promotionRules =
  await this.prisma.promotionRule.count({
    where: {
      tenantId,
      sessionId: currentSession.id,
    },
  });

  return {
  ready:
    classes > 0 &&
    sections > 0 &&
    promotionRules > 0,


    currentSession: {
      id: currentSession.id,
      name: currentSession.name,
    },

    targetSession: {
      id: targetSession.id,
      name: targetSession.name,
    },

    classes,
    sections,
    students,

    checks: {
      targetSessionExists: true,
      classesCopied: classes > 0,
      sectionsCopied: sections > 0,
    },
  };
}

}
