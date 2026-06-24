import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 'cmqqjpii80003yy8zhr2gm9uu';
const SESSION_ID = 'session_demo-school_2026';
const ACADEMIC_YEAR = '2026-27';

const BLOOD_GROUPS = [
  'A_POS',
  'B_POS',
  'AB_POS',
  'O_POS',
] as const;

const RELIGIONS = [
  'HINDU',
  'MUSLIM',
  'SIKH',
  'CHRISTIAN',
] as const;

const CATEGORIES = [
  'GENERAL',
  'OBC',
  'SC',
  'ST',
] as const;

function randomFrom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function main() {
  console.log('\n🎓 PHASE 4A - STUDENTS STARTED\n');

  const sections = await prisma.section.findMany({
    where: {
      tenantId: TENANT_ID,
    },
    include: {
      class: true,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  console.log(`Found ${sections.length} sections`);

  let globalCounter = 1;

  for (const section of sections) {
    const branchCode =
      section.branchId === 'br_demo-school_main'
        ? 'LKO'
        : 'ALJ';

    for (let i = 1; i <= 10; i++) {
      const admissionNumber =
        `ADM-${branchCode}-${String(globalCounter).padStart(5, '0')}`;

      const existing = await prisma.student.findFirst({
        where: {
          tenantId: TENANT_ID,
          admissionNumber,
        },
      });

      if (existing) {
        globalCounter++;
        continue;
      }

      const firstName = `Student${globalCounter}`;
      const lastName = branchCode;

      const student = await prisma.student.create({
        data: {
          tenantId: TENANT_ID,
          branchId: section.branchId,

          admissionNumber,
          admissionDate: new Date(),

          firstName,
          lastName,

          academicYear: ACADEMIC_YEAR,
          sessionId: SESSION_ID,

          classId: section.classId,
          sectionId: section.id,

          rollNumber: String(i).padStart(2, '0'),

          gender:
            globalCounter % 2 === 0
              ? 'MALE'
              : 'FEMALE',

          bloodGroup: randomFrom(BLOOD_GROUPS),

          religion: randomFrom(RELIGIONS),

          category: randomFrom(CATEGORIES),

          email: `student${globalCounter}@demo-school.com`,

          phone: `900${String(globalCounter)
            .padStart(7, '0')
            .slice(-7)}`,

          isActive: true,
        } as any,
      });

      const guardian = await prisma.guardian.create({
        data: {
          tenantId: TENANT_ID,

          firstName: `Parent${globalCounter}`,
          lastName: branchCode,

          phone: `800${String(globalCounter)
            .padStart(7, '0')
            .slice(-7)}`,

          email: `parent${globalCounter}@demo-school.com`,

          occupation: 'Private Employee',

          isActive: true,
        },
      });

      await prisma.guardianStudent.create({
        data: {
          guardianId: guardian.id,
          studentId: student.id,
          relation: 'FATHER',
          isPrimary: true,
        } as any,
      });

      globalCounter++;
    }
  }

  const totalStudents = await prisma.student.count({
    where: {
      tenantId: TENANT_ID,
    },
  });

  const totalGuardians = await prisma.guardian.count({
    where: {
      tenantId: TENANT_ID,
    },
  });

  console.log('\n================================');
  console.log(`Students  : ${totalStudents}`);
  console.log(`Guardians : ${totalGuardians}`);
  console.log('================================\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
