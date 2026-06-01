import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@infra/database/prisma.service';
import { AuditService } from '../../../core/compliance/audit.service';
import {
  CreateClassDto,
  UpdateClassDto,
  CreateSectionDto,
  UpdateSectionDto,
  CreateSubjectDto,
  UpdateSubjectDto,
  AssignTeacherDto,
  GenerateRollNumbersDto,
} from '../dto/academics.dto';

@Injectable()
export class AcademicsService {
  private readonly logger = new Logger(AcademicsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // ── Classes ───────────────────────────────────────────────────────────────
async findSessions(tenantId: string) {
  return this.prisma.academicSession.findMany({
    where: {
      tenantId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}


  async createClass(
    tenantId: string,
    branchId: string,
    dto: CreateClassDto,
    actorId: string,
  ) {
    const existing = await this.prisma.class.findFirst({
      where: {
        tenantId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Class "${dto.name}" already exists in this session.`,
      );
    }

    const cls = await this.prisma.class.create({
      data: {
        tenantId,
	branchId,
        sessionId: dto.sessionId,
        name: dto.name,
        displayOrder: dto.displayOrder ?? 0,
      } as any,
    });

    await this.audit.logCreate({
      tenantId,
      actorId,
      entityType: 'Class',
      entityId: cls.id,
      after: cls,
    });

    this.logger.log(
      `Class created: ${cls.name} | tenant: ${tenantId}`,
    );

    return cls;
  }

  async findAllClasses(
    tenantId: string,
    sessionId: string,
  ) {
    return this.prisma.class.findMany({
      where: {
        tenantId,
        sessionId,
      },
      include: {
    sections: {
      orderBy: {
        name: 'asc',
      },
    },
  },
      orderBy: {
        displayOrder: 'asc',
      },
    });
  }

  async findClassById(
    tenantId: string,
    id: string,
  ) {
    const cls = await this.prisma.class.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!cls) {
      throw new NotFoundException(
        `Class not found: ${id}`,
      );
    }

    return cls;
  }

  async updateClass(
    tenantId: string,
    id: string,
    dto: UpdateClassDto,
    actorId: string,
  ) {
    const cls = await this.findClassById(
      tenantId,
      id,
    );

    const updated = await this.prisma.class.update({
      where: {
        id,
      },
      data: dto,
    });

    await this.audit.logUpdate({
      tenantId,
      actorId,
      entityType: 'Class',
      entityId: id,
      before: cls,
      after: updated,
    });

    return updated;
  }

  // ── Sections ──────────────────────────────────────────────────────────────

  async createSection(
    tenantId: string,
    branchId: string,
    dto: CreateSectionDto,
    actorId: string,
  ) {
    const existing = await this.prisma.section.findFirst({
      where: {
        classId: dto.classId,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Section "${dto.name}" already exists in this class.`,
      );
    }

    const section = await this.prisma.section.create({
      data: {
        tenantId,
	branchId,
        classId: dto.classId,
        name: dto.name,
        capacity: dto.capacity ?? 40,
        classTeacherId:
          dto.classTeacherId ?? null,
      } as any,
    });

    await this.audit.logCreate({
      tenantId,
      actorId,
      entityType: 'Section',
      entityId: section.id,
      after: section,
    });

    this.logger.log(
      `Section created: ${section.name} | tenant: ${tenantId}`,
    );

    return section;
  }

  async findSectionById(
    tenantId: string,
    id: string,
  ) {
    const section = await this.prisma.section.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        class: true,
        timetableSlots: true,
      },
    });

    if (!section) {
      throw new NotFoundException(
        `Section not found: ${id}`,
      );
    }

    return section;
  }

  async updateSection(
    tenantId: string,
    id: string,
    dto: UpdateSectionDto,
    actorId: string,
  ) {
    const section = await this.findSectionById(
      tenantId,
      id,
    );

    const updated = await this.prisma.section.update({
      where: {
        id,
      },
      data: dto,
    });

    await this.audit.logUpdate({
      tenantId,
      actorId,
      entityType: 'Section',
      entityId: id,
      before: section,
      after: updated,
    });

    return updated;
  }

  // ── Subjects ──────────────────────────────────────────────────────────────

  async createSubject(
    tenantId: string,
    dto: CreateSubjectDto,
    actorId: string,
  ) {
    if (dto.code) {
      const existing = await this.prisma.subject.findFirst({
        where: {
          tenantId,
          code: dto.code,
        },
      });

      if (existing) {
        throw new ConflictException(
          `Subject with code "${dto.code}" already exists.`,
        );
      }
    }

    const subject = await this.prisma.subject.create({
      data: {
        tenantId,
        name: dto.name,
        code: dto.code ?? null,
      } as any,
    });

    await this.audit.logCreate({
      tenantId,
      actorId,
      entityType: 'Subject',
      entityId: subject.id,
      after: subject,
    });

    return subject;
  }

  async findAllSubjects(
    tenantId: string,
  ) {
    return this.prisma.subject.findMany({
      where: {
        tenantId,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findSubjectById(
    tenantId: string,
    id: string,
  ) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id,
        tenantId,
      },
    });

    if (!subject) {
      throw new NotFoundException(
        `Subject not found: ${id}`,
      );
    }

    return subject;
  }

  async updateSubject(
    tenantId: string,
    id: string,
    dto: UpdateSubjectDto,
    actorId: string,
  ) {
    const subject = await this.findSubjectById(
      tenantId,
      id,
    );

    const updated = await this.prisma.subject.update({
      where: {
        id,
      },
      data: dto,
    });

    await this.audit.logUpdate({
      tenantId,
      actorId,
      entityType: 'Subject',
      entityId: id,
      before: subject,
      after: updated,
    });

    return updated;
  }

  // ── Teacher Mapping ───────────────────────────────────────────────────────

  async assignTeacher(
    tenantId: string,
    dto: AssignTeacherDto,
    actorId: string,
  ) {
    const existing = await this.prisma.teacherAssignment.findFirst({
      where: {
        tenantId,
        sectionId: dto.sectionId,
        subjectId: dto.subjectId,
      },
    });

    if (existing) {
      const updated = await this.prisma.teacherAssignment.update({
        where: {
          id: existing.id,
        },
        data: {
          teacherId: dto.teacherId,
        },
      });

      return updated;
    }

    const mapping = await this.prisma.teacherAssignment.create({
      data: {
        tenantId,

        section: {
          connect: {
            id: dto.sectionId,
          },
        },

        subject: {
          connect: {
            id: dto.subjectId,
          },
        },

        teacher: {
          connect: {
            id: dto.teacherId,
          },
        },
      } as any,
    });

    await this.audit.logCreate({
      tenantId,
      actorId,
      entityType: 'TeacherMapping',
      entityId: mapping.id,
      after: mapping,
    });

    return mapping;
  }

  async getTeacherMappings(
    tenantId: string,
    sessionId: string,
    sectionId?: string,
  ) {
    return this.prisma.teacherAssignment.findMany({
      where: {
        tenantId,
        academicYearId: sessionId,
        ...(sectionId && { sectionId }),
      },
      include: {
        subject: true,
      },
      orderBy: {
        subject: {
          name: 'asc',
        },
      },
    });
  }

  // ── Subject Mappings ──────────────────────────────────────────────────────

  async createSubjectMapping(
    tenantId: string,
    dto: any,
    actorId: string,
  ) {
    const existing = await (this.prisma as any).subjectMapping.findFirst({
      where: {
        tenantId,
        classId: dto.classId,
        subjectId: dto.subjectId,
      },
    });

    if (existing) {
      return existing;
    }

    const mapping = await (this.prisma as any).subjectMapping.create({
      data: {
        tenantId,
        classId: dto.classId,
        subjectId: dto.subjectId,
        weeklyPeriods: dto.weeklyPeriods ?? 5,
      },
      include: {
        subject: {
          select: {
            name: true,
            code: true,
          },
        },
      },
    });

    await this.audit.logCreate({
      tenantId,
      actorId,
      entityType: 'SubjectMapping',
      entityId: mapping.id,
      after: mapping,
    });

    return mapping;
  }

  async getSubjectMappings(
    tenantId: string,
    classId?: string,
    sessionId?: string,
  ) {
    const where: any = {
      tenantId,
    };

    if (classId) {
      where.classId = classId;
    }

    if (sessionId) {
      where.class = {
        sessionId,
      };
    }

    return (this.prisma as any).subjectMapping.findMany({
      where,
      include: {
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            isElective: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  // ── Assign class teacher to a section ────────────────────────────────────

  async assignClassTeacher(
    tenantId: string,
    sectionId: string,
    staffId: string | null,
    actorId: string,
  ) {
    const section = await this.prisma.section.findFirst({
      where: {
        id: sectionId,
        tenantId,
      },
    });

    if (!section) {
      throw new NotFoundException(
        `Section not found: ${sectionId}`,
      );
    }

    const updated = await this.prisma.section.update({
      where: {
        id: sectionId,
      },
      data: {
        classTeacherId: staffId,
      },
      include: {
        class: {
          select: {
            name: true,
          },
        },
      },
    });

    await this.audit.logUpdate({
      tenantId,
      actorId,
      entityType: 'Section',
      entityId: sectionId,
      before: {
        classTeacherId:
          section.classTeacherId,
      },
      after: {
        classTeacherId: staffId,
      },
    });

    return updated;
  }

  async getClassTeacherAppointments(
    tenantId: string,
    sessionId: string,
  ) {
    const classes = await this.prisma.class.findMany({
      where: {
        tenantId,
        sessionId,
      },
      include: {
        sections: {
          include: {},
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    const allStaffIds = classes.flatMap((c: any) =>
      c.sections
        .map((s: any) => s.classTeacherId)
        .filter(Boolean),
    ) as string[];

    const staffProfiles =
      allStaffIds.length > 0
        ? await this.prisma.staffProfile.findMany({
            where: {
              id: {
                in: allStaffIds,
              },
              tenantId,
            },
            select: {
              id: true,
              staffId: true,
              firstName: true,
              lastName: true,
            },
          })
        : [];

    const staffMap = new Map(
      staffProfiles.map((s: any) => [s.id, s]),
    );

    return classes.map((cls: any) => ({
      ...cls,
      sections: cls.sections.map((sec: any) => ({
        ...sec,
        classTeacher: sec.classTeacherId
          ? staffMap.get(sec.classTeacherId) ?? null
          : null,
      })),
    }));
  }

async generateRollNumbers(
  tenantId: string,
  branchId: string,
  dto: GenerateRollNumbersDto,
  actorId: string,
) {
  const section = await this.prisma.section.findFirst({
    where: {
      id: dto.sectionId,
      classId: dto.classId,
    },
    include: {
      class: true,
    },
  });

  if (!section) {
    throw new NotFoundException('Section not found');
  }

  const students = await this.prisma.student.findMany({
    where: {
      tenantId,
      branchId,
      classId: dto.classId,
      sectionId: dto.sectionId,
      isActive: true,
    },
    orderBy: [
      { firstName: 'asc' },
      { lastName: 'asc' },
    ],
  });

  if (!students.length) {
    return {
      generated: 0,
      message: 'No active students found',
    };
  }

  await this.prisma.$transaction(
    students.map((student, index) =>
      this.prisma.student.update({
        where: {
          id: student.id,
        },
        data: {
          rollNumber: String(index + 1),
          rollAssignedAt: new Date(),
        },
      }),
    ),
  );

  await this.audit.logCreate({
    tenantId,
    actorId,
    entityType: 'RollNumberGeneration',
    entityId: dto.sectionId,
    after: {
      classId: dto.classId,
      sectionId: dto.sectionId,
      generated: students.length,
    },
  });

  return {
    generated: students.length,
    class: section.class.name,
    section: section.name,
    message: 'Roll numbers generated successfully',
  };
}

}
