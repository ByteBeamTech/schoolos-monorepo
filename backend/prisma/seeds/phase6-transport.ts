import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TENANT_ID = 'cmqqjpii80003yy8zhr2gm9uu';

async function main() {
  console.log('\n🚌 Phase 6 Transport Started\n');

  const routes = [
    {
      branchId: 'br_demo-school_main',
      name: 'LKO-R1 Aliganj',
      feeAmount: 1200,
      stops: ['Sector A', 'Sector B', 'Sector C'],
    },
    {
      branchId: 'br_demo-school_main',
      name: 'LKO-R2 Gomti Nagar',
      feeAmount: 1500,
      stops: ['Viram Khand', 'Patrakarpuram', 'Vineet Khand'],
    },
    {
      branchId: 'br_demo-school_main',
      name: 'LKO-R3 Indira Nagar',
      feeAmount: 1400,
      stops: ['Munshipulia', 'Takrohi', 'Amrapali'],
    },
    {
      branchId: 'br_demo-school_main',
      name: 'LKO-R4 Hazratganj',
      feeAmount: 1800,
      stops: ['Hazratganj', 'Husainganj', 'Lalbagh'],
    },
    {
      branchId: 'br_demo-school_main',
      name: 'LKO-R5 Jankipuram',
      feeAmount: 1300,
      stops: ['Jankipuram', 'Engineering College', 'Tedhi Pulia'],
    },

    {
      branchId: 'br_demo-school_aliganj',
      name: 'ALJ-R1 Aliganj Ext',
      feeAmount: 1200,
      stops: ['Sector H', 'Sector J', 'Sector K'],
    },
    {
      branchId: 'br_demo-school_aliganj',
      name: 'ALJ-R2 Kursi Road',
      feeAmount: 1500,
      stops: ['Kursi Road', 'IIM Road', 'Integral'],
    },
    {
      branchId: 'br_demo-school_aliganj',
      name: 'ALJ-R3 Mahanagar',
      feeAmount: 1600,
      stops: ['Mahanagar', 'Nishatganj', 'Badshahnagar'],
    },
    {
      branchId: 'br_demo-school_aliganj',
      name: 'ALJ-R4 Sitapur Road',
      feeAmount: 1700,
      stops: ['Sitapur Road', 'Bakshi Ka Talab', 'Itaunja'],
    },
    {
      branchId: 'br_demo-school_aliganj',
      name: 'ALJ-R5 Vikas Nagar',
      feeAmount: 1300,
      stops: ['Vikas Nagar', 'Ring Road', 'Kalyanpur'],
    },
  ];

  for (const route of routes) {
    const exists = await prisma.transportRoute.findFirst({
      where: {
        tenantId: TENANT_ID,
        branchId: route.branchId,
        name: route.name,
      },
    });

    if (!exists) {
      await prisma.transportRoute.create({
        data: {
          tenantId: TENANT_ID,
          branchId: route.branchId,
          name: route.name,
          description: `${route.name} School Route`,
          vehicleNumber: `UP32-${Math.floor(
            1000 + Math.random() * 9000,
          )}`,
          driverName: 'Demo Driver',
          driverPhone: '9876543210',
          feeAmount: route.feeAmount,
          stops: route.stops,
        },
      });
    }
  }

  const allRoutes = await prisma.transportRoute.findMany();

  const students = await prisma.student.findMany({
    orderBy: {
      admissionNumber: 'asc',
    },
  });

  let assigned = 0;

  for (let i = 0; i < students.length; i++) {
    if (i % 2 !== 0) continue;

    const student = students[i];

    const alreadyAssigned =
      await prisma.transportAssignment.findUnique({
        where: {
          studentId: student.id,
        },
      });

    if (alreadyAssigned) continue;

    const branchRoutes = allRoutes.filter(
      (r) => r.branchId === student.branchId,
    );

    const route =
      branchRoutes[
        Math.floor(Math.random() * branchRoutes.length)
      ];

    const stops = (route.stops as string[]) || [];

    await prisma.transportAssignment.create({
      data: {
        studentId: student.id,
        routeId: route.id,
        boardingStop:
          stops.length > 0
            ? stops[Math.floor(Math.random() * stops.length)]
            : null,
      },
    });

    assigned++;
  }

  console.log(`Routes: ${await prisma.transportRoute.count()}`);
  console.log(
    `Assignments: ${await prisma.transportAssignment.count()}`
  );

  console.log(`New Assignments: ${assigned}`);

  console.log('\n✅ Phase 6 Complete\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
