import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Helpers ──
const pick = (arr: any[]) => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const hash = (p: string) => bcrypt.hash(p, 12);

async function main() {
  console.log("\n🌱 Starting Realistic Demo Seed for Lucknow Campus...\n");

  // 1. Find Demo Tenant
  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo-school" } });
  if (!tenant) throw new Error("demo-school tenant not found. Run master seed first.");

  const session = await prisma.academicSession.findFirst({
    where: { tenantId: tenant.id, isCurrent: true },
  });
  if (!session) throw new Error("No current session found.");

  // 2. Classes & Sections
  console.log("1. Creating Classes & Sections...");
  const classes = ["Class 10", "Class 11", "Class 12"];
  for (const name of classes) {
    const cls = await prisma.class.upsert({
      where: { id: `${tenant.id}_${name.replace(' ', '_')}` },
      update: {},
      create: {
        id: `${tenant.id}_${name.replace(' ', '_')}`,
        name,
        tenantId: tenant.id,
        sessionId: session.id,
        isActive: true,
      },
    });

    for (const sec of ["A", "B"]) {
      await prisma.section.upsert({
        where: { id: `${cls.id}_${sec}` },
        update: {},
        create: {
          id: `${cls.id}_${sec}`,
          name: sec,
          classId: cls.id,
          tenantId: tenant.id,
          capacity: 40,
        },
      });
    }
  }

  // 3. Realistic Students (Creating 10 for sample)
  console.log("2. Seeding Students & Guardians...");
  const firstNames = ["Aarav", "Vivaan", "Ananya", "Saanvi", "Ishaan"];
  const lastNames = ["Sharma", "Verma", "Gupta", "Singh", "Yadav"];

  const sections = await prisma.section.findMany({ where: { tenantId: tenant.id } });

  for (let i = 0; i < 10; i++) {
    const fName = pick(firstNames);
    const lName = pick(lastNames);
    const admNo = `LKO-2026-${100 + i}`;

    const student = await prisma.student.create({
      data: {
        tenantId: tenant.id,
        branchId: "br_demo_main", // From your master seed
        admissionNumber: admNo,
        firstName: fName,
        lastName: lName,
        gender: pick(["MALE", "FEMALE"]) as any,
        dateOfBirth: new Date("2010-05-15"),
        sectionId: pick(sections).id,
        academicYear: session.id,
        rollNumber: `${i + 1}`,
        isActive: true,
        address: {
          addressLine: "123 Hazratganj",
          city: "Lucknow",
          state: "UP",
          pincode: "226001"
        } as any,
      },
    });

    // Create Guardian
    const guardian = await prisma.guardian.create({
      data: {
        tenantId: tenant.id,
        firstName: pick(firstNames),
        lastName: lName,
        phone: `+919839${rand(100000, 999999)}`,
        email: `parent.${admNo}@gmail.com`,
      }
    });

    await prisma.guardianStudent.create({
      data: {
        guardianId: guardian.id,
        studentId: student.id,
        relation: "FATHER",
        isPrimary: true
      }
    });
  }

  // 4. Announcements
  console.log("3. Seeding Announcements...");
  await prisma.announcement.create({
    data: {
      tenantId: tenant.id,
      title: "Annual Sports Meet 2026",
      body: "Sports meet will be held at Lucknow Stadium on 15th April.",
      publishedAt: new Date(),
      isPinned: true,
      createdBy: "system"
    }
  });

  console.log("\n✅ Demo Seed Complete! 10 Students & Data Added.");
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
