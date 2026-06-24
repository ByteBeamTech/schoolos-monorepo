import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 'cmqqjpii80003yy8zhr2gm9uu';
const SESSION_ID = 'session_demo-school_2026';
const ACADEMIC_YEAR = '2026-27';

function getFeeItems(className: string) {
  const lower = className.toLowerCase();

  if (
    lower.includes('nursery') ||
    lower.includes('lkg') ||
    lower.includes('ukg')
  ) {
    return [
      { name: 'Tuition Fee', amount: 1500, sortOrder: 1 },
      { name: 'Development Fee', amount: 500, sortOrder: 2 },
      { name: 'Exam Fee', amount: 200, sortOrder: 3 },
    ];
  }

  const classNumber = parseInt(
    className.replace('Class', '').trim(),
  );

  if (classNumber >= 1 && classNumber <= 5) {
    return [
      { name: 'Tuition Fee', amount: 2500, sortOrder: 1 },
      { name: 'Development Fee', amount: 700, sortOrder: 2 },
      { name: 'Exam Fee', amount: 300, sortOrder: 3 },
      { name: 'Sports Fee', amount: 200, sortOrder: 4 },
    ];
  }

  if (classNumber >= 6 && classNumber <= 8) {
    return [
      { name: 'Tuition Fee', amount: 3500, sortOrder: 1 },
      { name: 'Development Fee', amount: 1000, sortOrder: 2 },
      { name: 'Exam Fee', amount: 500, sortOrder: 3 },
      { name: 'Sports Fee', amount: 300, sortOrder: 4 },
      { name: 'Computer Fee', amount: 500, sortOrder: 5 },
    ];
  }

  return [
    { name: 'Tuition Fee', amount: 5000, sortOrder: 1 },
    { name: 'Development Fee', amount: 1500, sortOrder: 2 },
    { name: 'Exam Fee', amount: 700, sortOrder: 3 },
    { name: 'Sports Fee', amount: 500, sortOrder: 4 },
    { name: 'Computer Fee', amount: 1000, sortOrder: 5 },
  ];
}

async function main() {
  console.log('\n💰 Phase 5 Started\n');

  const classes = await prisma.class.findMany({
    include: {
      sections: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  let plansCreated = 0;

  for (const cls of classes) {
    const planName = `${cls.name} Fee Plan`;

    let plan = await prisma.feePlan.findFirst({
      where: {
        tenantId: TENANT_ID,
        branchId: cls.branchId,
        name: planName,
        academicYear: ACADEMIC_YEAR,
      },
    });

    if (!plan) {
      plan = await prisma.feePlan.create({
        data: {
          tenantId: TENANT_ID,
          branchId: cls.branchId,
          sessionId: SESSION_ID,
          academicYear: ACADEMIC_YEAR,
          name: planName,
          grade: cls.name,
          description: `${cls.name} Standard Fee Plan`,
        },
      });

      const items = getFeeItems(cls.name);

      for (const item of items) {
        await prisma.feeItem.create({
          data: {
            feePlanId: plan.id,
            name: item.name,
            amount: item.amount,
            sortOrder: item.sortOrder,
          },
        });
      }

      plansCreated++;
    }

    const students = await prisma.student.findMany({
      where: {
        tenantId: TENANT_ID,
        branchId: cls.branchId,
        classId: cls.id,
      },
    });

    for (const student of students) {
      const exists = await prisma.feeAssignment.findFirst({
        where: {
          studentId: student.id,
          feePlanId: plan.id,
          academicYear: ACADEMIC_YEAR,
        },
      });

      if (exists) continue;

      await prisma.feeAssignment.create({
        data: {
          tenantId: TENANT_ID,
          studentId: student.id,
          branchId: student.branchId,
          feePlanId: plan.id,
          academicYear: ACADEMIC_YEAR,
          assignedBy: 'SYSTEM',
        },
      });
    }
  }

  console.log(`Fee Plans Created: ${plansCreated}`);

  console.log(
    `Fee Assignments: ${
      await prisma.feeAssignment.count({
        where: {
          tenantId: TENANT_ID,
        },
      })
    }`,
  );

  console.log(
    `Fee Plans: ${
      await prisma.feePlan.count({
        where: {
          tenantId: TENANT_ID,
        },
      })
    }`,
  );

  console.log('\n✅ Phase 5 Complete\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
