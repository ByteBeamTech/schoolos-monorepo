import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function hash(password: string) {
  return bcrypt.hash(password, 12);
}

async function main() {
  console.log('\n🌱 SchoolOS Phase-1 Seed Started\n');

  // =====================================================
  // PASSWORDS
  // =====================================================

  const superAdminPassword = await hash('SchoolOS@2026');
  const schoolPassword = await hash('Demo@123!');

  // =====================================================
  // PLATFORM TENANT
  // =====================================================

  const platformTenant = await prisma.tenant.upsert({
    where: {
      slug: 'schoolos-platform',
    },
    update: {},
    create: {
      name: 'SchoolOS Platform',
      slug: 'schoolos-platform',
      contactEmail: 'admin@bytebeamtech.com',
      status: 'ACTIVE',
//      featureTier: 'ENTERPRISE',
      region: 'IN',
      currency: 'INR',
    },
  });

  console.log('✅ Platform Tenant Ready');
   
  // =====================================================
// =====================================================


 


  // =====================================================
  // SUPER ADMIN
  // =====================================================

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: platformTenant.id,
        email: 'admin@bytebeamtech.com',
      },
    },
    update: {
      passwordHash: superAdminPassword,
      isActive: true,
    },
    create: {
      tenantId: platformTenant.id,
      email: 'admin@bytebeamtech.com',
      passwordHash: superAdminPassword,
      firstName: 'ByteBeam',
      lastName: 'Admin',
      role: 'SUPER_ADMIN',
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log('✅ Super Admin Ready');

  // =====================================================
  // DEMO SCHOOL TENANT
  // =====================================================

  const demoTenant = await prisma.tenant.upsert({
    where: {
      slug: 'demo-school',
    },
    update: {},
    create: {
      name: 'Demo International School',
      slug: 'demo-school',
      contactEmail: 'admin@demo-school.com',
      status: 'ACTIVE',
      region: 'IN',
      currency: 'INR',
    },
  });

  console.log('✅ Demo School Tenant Ready');
    

 // =====================================================
// SCHOOL OWNER
// =====================================================

const schoolOwner = await prisma.user.upsert({
  where: {
    tenantId_email: {
      tenantId: demoTenant.id,
      email: 'owner@demo-school.com',
    },
  },
  update: {
    passwordHash: schoolPassword,
    isActive: true,
  },
  create: {
    tenantId: demoTenant.id,
    email: 'owner@demo-school.com',
    passwordHash: schoolPassword,
    firstName: 'Demo',
    lastName: 'Owner',
    role: 'SCHOOL_OWNER',
    isActive: true,
    isEmailVerified: true,
  },
});

console.log('✅ School Owner Ready');









  // =====================================================
  // SCHOOL ADMIN
  // =====================================================

  const schoolAdmin = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: 'admin@demo-school.com',
      },
    },
    update: {
      passwordHash: schoolPassword,
      isActive: true,
    },
    create: {
      tenantId: demoTenant.id,
      email: 'admin@demo-school.com',
      passwordHash: schoolPassword,
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'SCHOOL_ADMIN',
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log('✅ School Admin Ready');

  // =====================================================
  // BRANCHES
  // =====================================================

  const lucknowBranch = await prisma.branch.upsert({
    where: {
      id: 'br_demo-school_main',
    },
    update: {},
    create: {
      id: 'br_demo-school_main',
      tenantId: demoTenant.id,
      name: 'Lucknow Main Branch',
      branchCode: 'LKO',
      city: 'Lucknow',
      isPrimary: true,
      isActive: true,
      email: 'admin@demo-school.com',
      phone: '9999999991',
    },
  });

  const aliganjBranch = await prisma.branch.upsert({
    where: {
      id: 'br_demo-school_aliganj',
    },
    update: {},
    create: {
      id: 'br_demo-school_aliganj',
      tenantId: demoTenant.id,
      name: 'Aliganj Branch',
      branchCode: 'ALJ',
      city: 'Lucknow',
      isPrimary: false,
      isActive: true,
      email: 'admin@demo-school.com',
      phone: '9999999992',
    },
  });

  console.log('✅ Branches Ready');
await prisma.userBranch.upsert({
  where: {
    userId_branchId: {
      userId: schoolOwner.id,
      branchId: lucknowBranch.id,
    },
  },
  update: {},
  create: {
    tenantId: demoTenant.id,
    userId: schoolOwner.id,
    branchId: lucknowBranch.id,
    isDefault: true,
    isActive: true,
  },
});

await prisma.userBranch.upsert({
  where: {
    userId_branchId: {
      userId: schoolOwner.id,
      branchId: aliganjBranch.id,
    },
  },
  update: {},
  create: {
    tenantId: demoTenant.id,
    userId: schoolOwner.id,
    branchId: aliganjBranch.id,
    isDefault: false,
    isActive: true,
  },
});
  // =====================================================
  // USER BRANCH MAPPINGS
  // =====================================================

  await prisma.userBranch.upsert({
    where: {
      userId_branchId: {
        userId: schoolAdmin.id,
        branchId: lucknowBranch.id,
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      userId: schoolAdmin.id,
      branchId: lucknowBranch.id,
      isDefault: true,
      isActive: true,
    },
  });

  await prisma.userBranch.upsert({
    where: {
      userId_branchId: {
        userId: schoolAdmin.id,
        branchId: aliganjBranch.id,
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      userId: schoolAdmin.id,
      branchId: aliganjBranch.id,
      isDefault: false,
      isActive: true,
    },
  });

  console.log('✅ User Branch Mapping Ready');

  // =====================================================
  // SESSION
  // =====================================================
  const academicSession = await prisma.academicSession.upsert({
    where: {
      id: 'session_demo-school_2026',
    },
    update: {
      isCurrent: true,
    },
    create: {
      id: 'session_demo-school_2026',
      tenantId: demoTenant.id,
      name: '2026-27',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      isCurrent: true,
      isLocked: false,
      admissionsOpen: true,
    },
  });

  console.log('✅ Academic Session Ready');
   
 // =====================================================
// CLASSES + SECTIONS
// =====================================================

const branches = [lucknowBranch, aliganjBranch];

const classNames = [
  'Nursery',
  'LKG',
  'UKG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
];

function feeItemsForClass(className: string) {
  const lower = className.toLowerCase();

  if (lower.includes('nursery') || lower.includes('lkg') || lower.includes('ukg')) {
    return [
      { name: 'Tuition Fee', amount: 1500, sortOrder: 1 },
      { name: 'Development Fee', amount: 500, sortOrder: 2 },
      { name: 'Exam Fee', amount: 200, sortOrder: 3 },
    ];
  }

  const match = className.match(/(\d+)/);
  const classNumber = match ? Number(match[1]) : 0;

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

let classCount = 0;
let sectionCount = 0;

for (const branch of branches) {
  console.log(`🏫 Creating classes for ${branch.name}`);

  for (let i = 0; i < classNames.length; i++) {
    const className = classNames[i];

    const cls = await prisma.class.upsert({
      where: {
        tenantId_branchId_sessionId_name: {
          tenantId: demoTenant.id,
          branchId: branch.id,
          sessionId: academicSession.id,
          name: className,
        },
      },
      update: {},
      create: {
        tenantId: demoTenant.id,
        branchId: branch.id,
        sessionId: academicSession.id,
        name: className,
        displayOrder: i + 1,
        isActive: true,
      },
    });

    classCount++;

    await prisma.section.upsert({
      where: {
        tenantId_classId_name: {
          tenantId: demoTenant.id,
          classId: cls.id,
          name: 'A',
        },
      },
      update: {},
      create: {
        tenantId: demoTenant.id,
        branchId: branch.id,
        classId: cls.id,
        name: 'A',
        capacity: 40,
        isActive: true,
      },
    });

    sectionCount++;

    await prisma.section.upsert({
      where: {
        tenantId_classId_name: {
          tenantId: demoTenant.id,
          classId: cls.id,
          name: 'B',
        },
      },
      update: {},
      create: {
        tenantId: demoTenant.id,
        branchId: branch.id,
        classId: cls.id,
        name: 'B',
        capacity: 40,
        isActive: true,
      },
    });

    sectionCount++;
  }
}

console.log(`✅ Classes Created: ${classCount}`);
console.log(`✅ Sections Created: ${sectionCount}`);

// =====================================================
// CLASS-LEVEL FEE PLANS + ASSIGNMENTS
// =====================================================

const feePlanClasses = await prisma.class.findMany({
  where: { tenantId: demoTenant.id, sessionId: academicSession.id },
  include: { sections: true },
  orderBy: { displayOrder: 'asc' },
});

for (const currentClass of feePlanClasses) {
  const planName = `${currentClass.name} Fee Plan`;
  let plan = await prisma.feePlan.findFirst({
    where: {
      tenantId: demoTenant.id,
      branchId: currentClass.branchId,
      name: planName,
      academicYear: academicSession.name,
    },
  });

  if (!plan) {
    plan = await prisma.feePlan.create({
      data: {
        tenantId: demoTenant.id,
        branchId: currentClass.branchId,
        sessionId: academicSession.id,
        name: planName,
        academicYear: academicSession.name,
        grade: currentClass.name,
        description: `${currentClass.name} standard fee plan`,
        currency: 'INR',
        isActive: true,
      },
    });
  }

  for (const item of feeItemsForClass(currentClass.name)) {
    const existingItem = await prisma.feeItem.findFirst({
      where: { feePlanId: plan.id, name: item.name },
    });
    if (!existingItem) {
      await prisma.feeItem.create({
        data: {
          feePlanId: plan.id,
          name: item.name,
          amount: item.amount,
          sortOrder: item.sortOrder,
          isOptional: false,
        },
      });
    }
  }

  for (const section of currentClass.sections) {
    const existingAssignment = await prisma.feePlanAssignment.findFirst({
      where: {
        tenantId: demoTenant.id,
        sessionId: academicSession.id,
        classId: currentClass.id,
        sectionId: section.id,
      },
    });

    if (!existingAssignment) {
      await prisma.feePlanAssignment.create({
        data: {
          tenantId: demoTenant.id,
          branchId: currentClass.branchId,
          sessionId: academicSession.id,
          feePlanId: plan.id,
          classId: currentClass.id,
          sectionId: section.id,
          createdById: 'seed-system',
        },
      });
    }
  }

  const classLevelAssignment = await prisma.feePlanAssignment.findFirst({
    where: {
      tenantId: demoTenant.id,
      sessionId: academicSession.id,
      classId: currentClass.id,
      sectionId: null,
    },
  });

  if (!classLevelAssignment) {
    await prisma.feePlanAssignment.create({
      data: {
        tenantId: demoTenant.id,
        branchId: currentClass.branchId,
        sessionId: academicSession.id,
        feePlanId: plan.id,
        classId: currentClass.id,
        sectionId: null,
        createdById: 'seed-system',
      },
    });
  }
}

console.log(`✅ Fee Plans Ready: ${await prisma.feePlan.count({ where: { tenantId: demoTenant.id } })}`);
console.log(`✅ Fee Plan Assignments Ready: ${await prisma.feePlanAssignment.count({ where: { tenantId: demoTenant.id } })}`);

// =====================================================
// STAFF USERS + STAFF + STAFF PROFILES
// =====================================================

const commonPasswordHash = await hash('Demo@123!');

const staffSeeds = [
  {
    email: 'bytebeamtech@gmail.com',
    firstName: 'Branch',
    lastName: 'Principal',
    role: 'PRINCIPAL',
    employeeId: 'EMP-LKO-0001',
    designation: 'Principal',
    branch: lucknowBranch,
    gender: 'MALE',
  },
  {
    email: 'vibhakar8@gmail.com',
    firstName: 'Vibhakar',
    lastName: 'Srivastava',
    role: 'TEACHER',
    employeeId: 'EMP-LKO-0002',
    designation: 'Teacher',
    branch: lucknowBranch,
    gender: 'MALE',
  },
  {
    email: 'iconicshala@gmail.com',
    firstName: 'Aliganj',
    lastName: 'Principal',
    role: 'PRINCIPAL',
    employeeId: 'EMP-ALJ-0001',
    designation: 'Principal',
    branch: aliganjBranch,
    gender: 'MALE',
  },
  {
    email: 'vibhakarsrivastava8@gmail.com',
    firstName: 'Vibhakar',
    lastName: 'Teacher',
    role: 'TEACHER',
    employeeId: 'EMP-ALJ-0002',
    designation: 'Teacher',
    branch: aliganjBranch,
    gender: 'MALE',
  },
];

for (const s of staffSeeds) {
  // ----------------------------------
  // USER
  // ----------------------------------

  const user = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: s.email,
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: s.email,
      passwordHash: commonPasswordHash,
      firstName: s.firstName,
      lastName: s.lastName,
      role: s.role as any,
      isActive: true,
      isEmailVerified: true,
    },
  });

  // ----------------------------------
  // USER BRANCH
  // ----------------------------------

  await prisma.userBranch.upsert({
    where: {
      userId_branchId: {
        userId: user.id,
        branchId: s.branch.id,
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      userId: user.id,
      branchId: s.branch.id,
      isDefault: true,
      isActive: true,
    },
  });

  // ----------------------------------
  // STAFF
  // ----------------------------------

  let staff = await prisma.staff.findFirst({
    where: {
      tenantId: demoTenant.id,
      employeeId: s.employeeId,
    },
  });

  if (!staff) {
    staff = await prisma.staff.create({
      data: {
        tenantId: demoTenant.id,
        branchId: s.branch.id,
        userId: user.id,
        employeeId: s.employeeId,
        designation: s.designation,
        department: 'Academics',
        type: 'TEACHING',
        dateOfJoining: new Date('2026-04-01'),
        isActive: true,
        status: 'ACTIVE',
      },
    });
  }

  // ----------------------------------
  // STAFF PROFILE
  // ----------------------------------

  const existingProfile = await prisma.staffProfile.findFirst({
    where: {
      staffId: staff.id,
    },
  });

  if (!existingProfile) {
    await prisma.staffProfile.create({
      data: {
        tenantId: demoTenant.id,
        branchId: s.branch.id,
        staffId: staff.id,
        userId: user.id,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: s.gender as any,
        qualification: 'Post Graduate',
        experience: 5,
      },
    });
  }

  console.log(`✅ Staff Ready: ${s.email}`);
}

console.log('✅ Staff Users Created');
console.log('✅ Staff Profiles Created');
// =====================================================
// PHASE 3B - ADDITIONAL STAFF
// =====================================================

const additionalStaff = [
  // Lucknow
  {
    email: 'vp.lucknow@demo-school.com',
    firstName: 'Vice',
    lastName: 'Principal',
    role: 'VICE_PRINCIPAL',
    employeeId: 'EMP-LKO-0003',
    designation: 'Vice Principal',
    branch: lucknowBranch,
    type: 'TEACHING',
  },
  {
    email: 'accounts.lucknow@demo-school.com',
    firstName: 'Accounts',
    lastName: 'Lucknow',
    role: 'ACCOUNTANT',
    employeeId: 'EMP-LKO-0004',
    designation: 'Accountant',
    branch: lucknowBranch,
    type: 'NON_TEACHING',
  },
  {
    email: 'reception.lucknow@demo-school.com',
    firstName: 'Reception',
    lastName: 'Lucknow',
    role: 'RECEPTIONIST',
    employeeId: 'EMP-LKO-0005',
    designation: 'Receptionist',
    branch: lucknowBranch,
    type: 'NON_TEACHING',
  },
  {
    email: 'library.lucknow@demo-school.com',
    firstName: 'Library',
    lastName: 'Lucknow',
    role: 'LIBRARIAN',
    employeeId: 'EMP-LKO-0006',
    designation: 'Librarian',
    branch: lucknowBranch,
    type: 'NON_TEACHING',
  },
  {
    email: 'nurse.lucknow@demo-school.com',
    firstName: 'School',
    lastName: 'Nurse',
    role: 'NURSE',
    employeeId: 'EMP-LKO-0007',
    designation: 'Nurse',
    branch: lucknowBranch,
    type: 'NON_TEACHING',
  },
  {
    email: 'transport.lucknow@demo-school.com',
    firstName: 'Transport',
    lastName: 'Manager',
    role: 'TRANSPORT_MANAGER',
    employeeId: 'EMP-LKO-0008',
    designation: 'Transport Manager',
    branch: lucknowBranch,
    type: 'NON_TEACHING',
  },

  // Aliganj
  {
    email: 'vp.aliganj@demo-school.com',
    firstName: 'Vice',
    lastName: 'Principal',
    role: 'VICE_PRINCIPAL',
    employeeId: 'EMP-ALJ-0003',
    designation: 'Vice Principal',
    branch: aliganjBranch,
    type: 'TEACHING',
  },
  {
    email: 'accounts.aliganj@demo-school.com',
    firstName: 'Accounts',
    lastName: 'Aliganj',
    role: 'ACCOUNTANT',
    employeeId: 'EMP-ALJ-0004',
    designation: 'Accountant',
    branch: aliganjBranch,
    type: 'NON_TEACHING',
  },
  {
    email: 'reception.aliganj@demo-school.com',
    firstName: 'Reception',
    lastName: 'Aliganj',
    role: 'RECEPTIONIST',
    employeeId: 'EMP-ALJ-0005',
    designation: 'Receptionist',
    branch: aliganjBranch,
    type: 'NON_TEACHING',
  },
  {
    email: 'library.aliganj@demo-school.com',
    firstName: 'Library',
    lastName: 'Aliganj',
    role: 'LIBRARIAN',
    employeeId: 'EMP-ALJ-0006',
    designation: 'Librarian',
    branch: aliganjBranch,
    type: 'NON_TEACHING',
  },
  {
    email: 'nurse.aliganj@demo-school.com',
    firstName: 'School',
    lastName: 'Nurse',
    role: 'NURSE',
    employeeId: 'EMP-ALJ-0007',
    designation: 'Nurse',
    branch: aliganjBranch,
    type: 'NON_TEACHING',
  },
  {
    email: 'transport.aliganj@demo-school.com',
    firstName: 'Transport',
    lastName: 'Manager',
    role: 'TRANSPORT_MANAGER',
    employeeId: 'EMP-ALJ-0008',
    designation: 'Transport Manager',
    branch: aliganjBranch,
    type: 'NON_TEACHING',
  },
]; 
for (let i = 1; i <= 7; i++) {
  additionalStaff.push({
    email: `teacher${i}.lucknow@demo-school.com`,
    firstName: 'Teacher',
    lastName: `LKO${i}`,
    role: 'TEACHER',
    employeeId: `EMP-LKO-${String(i + 8).padStart(4, '0')}`,
    designation: 'Teacher',
    branch: lucknowBranch,
    type: 'TEACHING',
  } as any);

  additionalStaff.push({
    email: `teacher${i}.aliganj@demo-school.com`,
    firstName: 'Teacher',
    lastName: `ALJ${i}`,
    role: 'TEACHER',
    employeeId: `EMP-ALJ-${String(i + 8).padStart(4, '0')}`,
    designation: 'Teacher',
    branch: aliganjBranch,
    type: 'TEACHING',
  } as any);
}

for (const s of additionalStaff) {
  const user = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: demoTenant.id,
        email: s.email,
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      email: s.email,
      passwordHash: commonPasswordHash,
      firstName: s.firstName,
      lastName: s.lastName,
      role: s.role as any,
      isActive: true,
      isEmailVerified: true,
    },
  });

  await prisma.userBranch.upsert({
    where: {
      userId_branchId: {
        userId: user.id,
        branchId: s.branch.id,
      },
    },
    update: {},
    create: {
      tenantId: demoTenant.id,
      userId: user.id,
      branchId: s.branch.id,
      isDefault: true,
      isActive: true,
    },
  });

  let staff = await prisma.staff.findFirst({
    where: {
      tenantId: demoTenant.id,
      employeeId: s.employeeId,
    },
  });

  if (!staff) {
    staff = await prisma.staff.create({
      data: {
        tenantId: demoTenant.id,
        branchId: s.branch.id,
        userId: user.id,
        employeeId: s.employeeId,
        designation: s.designation,
        department: 'Academics',
        type: s.type as any,
        dateOfJoining: new Date('2026-04-01'),
        isActive: true,
        status: 'ACTIVE',
      },
    });
  }

  const existingProfile = await prisma.staffProfile.findFirst({
    where: {
      staffId: staff.id,
    },
  });

  if (!existingProfile) {
    await prisma.staffProfile.create({
      data: {
        tenantId: demoTenant.id,
        branchId: s.branch.id,
        staffId: staff.id,
        userId: user.id,
        firstName: s.firstName,
        lastName: s.lastName,
        gender: 'MALE' as any,
        qualification: 'Post Graduate',
        experience: 5,
      },
    });
  }

  console.log(`✅ Additional Staff Ready: ${s.email}`);
}

console.log('✅ Phase 3B Complete');

  // =====================================================
  // ACADEMIC DATA FOR LOCAL DEMO WORKFLOWS
  // =====================================================

  const subjectPresets = [
    { name: 'Mathematics', code: 'MATH', isElective: false },
    { name: 'English', code: 'ENG', isElective: false },
    { name: 'Hindi', code: 'HIN', isElective: false },
    { name: 'Science', code: 'SCI', isElective: false },
    { name: 'Social Studies', code: 'SST', isElective: false },
    { name: 'Computer Science', code: 'CS', isElective: false },
    { name: 'Physics', code: 'PHY', isElective: false },
    { name: 'Chemistry', code: 'CHEM', isElective: false },
    { name: 'Biology', code: 'BIO', isElective: false },
    { name: 'Physical Education', code: 'PE', isElective: false },
    { name: 'Art & Craft', code: 'ART', isElective: true },
    { name: 'Music', code: 'MUS', isElective: true },
    { name: 'Economics', code: 'ECO', isElective: false },
    { name: 'Accountancy', code: 'ACC', isElective: false },
    { name: 'Business Studies', code: 'BST', isElective: false },
  ];

  const subjectRows = new Map<string, any>();

  for (const subject of subjectPresets) {
    const created = await prisma.subject.upsert({
      where: {
        tenantId_code: {
          tenantId: demoTenant.id,
          code: subject.code,
        },
      },
      update: {
        name: subject.name,
        isActive: true,
        isElective: subject.isElective,
      },
      create: {
        tenantId: demoTenant.id,
        branchId: lucknowBranch.id,
        name: subject.name,
        code: subject.code,
        isActive: true,
        type: 'THEORY',
        isElective: subject.isElective,
      },
    });
    subjectRows.set(subject.code, created);
  }

  console.log('✅ Academic Subjects Ready');

  const demoTeacherStaff = await prisma.staff.findFirst({
    where: {
      tenantId: demoTenant.id,
      branchId: lucknowBranch.id,
      designation: 'Teacher',
      isActive: true,
    },
  });

  const demoTeacherProfile = demoTeacherStaff
    ? await prisma.staffProfile.findFirst({
        where: { staffId: demoTeacherStaff.id },
      })
    : null;

  const allClasses = await prisma.class.findMany({
    where: {
      tenantId: demoTenant.id,
      sessionId: academicSession.id,
    },
    include: { sections: true },
  });

  for (const currentClass of allClasses) {
    const mappedSubjects = subjectPresets.slice(0, currentClass.name.startsWith('Class 6') ? 7 : 5);

    for (const subject of mappedSubjects) {
      const subjectRow = subjectRows.get(subject.code);
      if (!subjectRow) continue;

      await prisma.subjectMapping.upsert({
        where: {
          tenantId_academicYearId_classId_subjectId: {
            tenantId: demoTenant.id,
            academicYearId: academicSession.id,
            classId: currentClass.id,
            subjectId: subjectRow.id,
          },
        },
        update: {
          weeklyPeriods: 5,
        },
        create: {
          tenantId: demoTenant.id,
          academicYearId: academicSession.id,
          classId: currentClass.id,
          subjectId: subjectRow.id,
          weeklyPeriods: 5,
        },
      });
    }

    for (const section of currentClass.sections) {
      if (demoTeacherStaff && demoTeacherProfile) {
        const classTeacherId = section.classTeacherId ?? demoTeacherStaff.id;
        await prisma.section.update({
          where: { id: section.id },
          data: { classTeacherId },
        });

        for (const subject of mappedSubjects.slice(0, 4)) {
          const subjectRow = subjectRows.get(subject.code);
          if (!subjectRow) continue;

          await prisma.teacherAssignment.upsert({
            where: {
              teacherId_subjectId_classId_sectionId_academicYearId: {
                teacherId: demoTeacherProfile.id,
                subjectId: subjectRow.id,
                classId: currentClass.id,
                sectionId: section.id,
                academicYearId: academicSession.id,
              },
            },
            update: {},
            create: {
              tenantId: demoTenant.id,
              branchId: lucknowBranch.id,
              teacherId: demoTeacherProfile.id,
              subjectId: subjectRow.id,
              classId: currentClass.id,
              sectionId: section.id,
              academicYearId: academicSession.id,
              isClassTeacher: section.classTeacherId === demoTeacherStaff.id || section.id === currentClass.sections[0]?.id,
            },
          });
        }
      }

      if (section.name === 'A') {
        const teacherId = demoTeacherStaff?.id ?? '';
        if (teacherId) {
          const timeTableSubjects = mappedSubjects.slice(0, 5);
          for (let period = 1; period <= 5; period++) {
            const subject = timeTableSubjects[period - 1];
            if (!subject) continue;
            const subjectRow = subjectRows.get(subject.code);
            if (!subjectRow) continue;

            const slotStart = ['08:00', '08:45', '09:30', '10:15', '11:00'][period - 1];
            const slotEnd = ['08:45', '09:30', '10:15', '11:00', '11:45'][period - 1];

            await prisma.timetableSlot.upsert({
              where: {
                tenantId_sectionId_dayOfWeek_periodNumber: {
                  tenantId: demoTenant.id,
                  sectionId: section.id,
                  dayOfWeek: 1,
                  periodNumber: period,
                },
              },
              update: {
                subjectId: subjectRow.id,
                teacherId: teacherId,
                startTime: slotStart,
                endTime: slotEnd,
              },
              create: {
                tenantId: demoTenant.id,
                sectionId: section.id,
                subjectId: subjectRow.id,
                teacherId: teacherId,
                dayOfWeek: 1,
                periodNumber: period,
                startTime: slotStart,
                endTime: slotEnd,
                roomId: `R-${section.name}`,
                isActive: true,
              },
            });
          }
        }
      }
    }
  }

  console.log('✅ Timetable and Section Mappings Ready');

  const targetClass = allClasses.find(
    (item) => item.name === 'Class 6' && item.branchId === lucknowBranch.id,
  );
  const targetSection = targetClass?.sections.find((item) => item.name === 'A') ?? targetClass?.sections[0];
  const targetSubjects = subjectPresets.slice(0, 5).map((s) => subjectRows.get(s.code)).filter(Boolean);

  let targetExam = await prisma.exam.findFirst({
    where: {
      tenantId: demoTenant.id,
      sessionId: academicSession.id,
      name: 'Mid Term Exam 2026',
    },
  });

  if (!targetExam) {
    targetExam = await prisma.exam.create({
      data: {
        tenantId: demoTenant.id,
        sessionId: academicSession.id,
        name: 'Mid Term Exam 2026',
        type: 'MID_TERM',
        startDate: new Date('2026-09-10'),
        endDate: new Date('2026-09-18'),
        isPublished: true,
      },
    });
  }

  const studentSeeds = [
    { admissionNumber: 'ADM-CL6-001', firstName: 'Aarav', lastName: 'Sharma', rollNumber: '01' },
    { admissionNumber: 'ADM-CL6-002', firstName: 'Diya', lastName: 'Verma', rollNumber: '02' },
    { admissionNumber: 'ADM-CL6-003', firstName: 'Rohan', lastName: 'Gupta', rollNumber: '03' },
    { admissionNumber: 'ADM-CL6-004', firstName: 'Meera', lastName: 'Singh', rollNumber: '04' },
    { admissionNumber: 'ADM-CL6-005', firstName: 'Kabir', lastName: 'Patel', rollNumber: '05' },
    { admissionNumber: 'ADM-CL6-006', firstName: 'Ananya', lastName: 'Nair', rollNumber: '06' },
  ];

  if (targetClass && targetSection) {
    for (const seed of studentSeeds) {
      await prisma.student.upsert({
        where: {
          tenantId_admissionNumber: {
            tenantId: demoTenant.id,
            admissionNumber: seed.admissionNumber,
          },
        },
        update: {
          branchId: lucknowBranch.id,
          firstName: seed.firstName,
          lastName: seed.lastName,
          classId: targetClass.id,
          sectionId: targetSection.id,
          academicYear: academicSession.name,
          sessionId: academicSession.id,
          rollNumber: seed.rollNumber,
          isActive: true,
        },
        create: {
          tenantId: demoTenant.id,
          branchId: lucknowBranch.id,
          admissionNumber: seed.admissionNumber,
          firstName: seed.firstName,
          lastName: seed.lastName,
          classId: targetClass.id,
          sectionId: targetSection.id,
          academicYear: academicSession.name,
          sessionId: academicSession.id,
          rollNumber: seed.rollNumber,
          status: 'ENROLLED',
          isActive: true,
          email: `${seed.firstName.toLowerCase()}.${seed.lastName.toLowerCase()}@demo-school.com`,
          phone: `9${String(Math.floor(Math.random() * 900000000) + 100000000)}`,
        },
      });
    }
  }

  if (targetClass && targetSection && targetExam) {
    for (const subject of targetSubjects) {
      if (!subject) continue;

      const schedule = await prisma.examSchedule.upsert({
        where: {
          examId_classId_subjectId: {
            examId: targetExam.id,
            classId: targetClass.id,
            subjectId: subject.id,
          },
        },
        update: {},
        create: {
          examId: targetExam.id,
          classId: targetClass.id,
          subjectId: subject.id,
          date: new Date('2026-09-12T09:00:00.000Z'),
          startTime: '09:00',
          endTime: '10:30',
          maxMarks: new Prisma.Decimal(100),
          passMarks: new Prisma.Decimal(33),
        },
      });

      const classStudents = await prisma.student.findMany({
        where: {
          tenantId: demoTenant.id,
          classId: targetClass.id,
          sectionId: targetSection.id,
        },
      });

      for (let index = 0; index < classStudents.length; index++) {
        const student = classStudents[index];
        if (!student) continue;

        const marksObtained = [88, 76, 91, 65][index % 4] ?? 72;
        await prisma.mark.upsert({
          where: {
            examId_studentId_scheduleId: {
              examId: targetExam.id,
              studentId: student.id,
              scheduleId: schedule.id,
            },
          },
          update: {
            marksObtained: new Prisma.Decimal(String(marksObtained)),
            isAbsent: false,
            remarks: 'Good performance',
            enteredBy: schoolAdmin.id,
          },
          create: {
            tenantId: demoTenant.id,
            examId: targetExam.id,
            studentId: student.id,
            scheduleId: schedule.id,
            marksObtained: new Prisma.Decimal(String(marksObtained)),
            isAbsent: false,
            remarks: 'Good performance',
            enteredBy: schoolAdmin.id,
          },
        });
      }
    }
  }

  console.log('✅ Demo Students Ready');

  const transportRoutes = [
    {
      name: 'City Pickup Route',
      branchId: lucknowBranch.id,
      vehicleNumber: 'UP32 AB 1234',
      driverName: 'Ramesh Kumar',
      driverPhone: '9876543210',
      feeAmount: 1200,
      description: 'Pickup for residential areas near Hazratganj and Aliganj',
      stops: ['Hazratganj', 'Aliganj', 'Aashiyana'],
    },
    {
      name: 'School Loop Route',
      branchId: aliganjBranch.id,
      vehicleNumber: 'UP32 CD 5678',
      driverName: 'Sanjay Singh',
      driverPhone: '9876543211',
      feeAmount: 1500,
      description: 'Pickup for Aliganj and surrounding neighbourhoods',
      stops: ['Aliganj', 'Indira Nagar', 'Mahanagar'],
    },
  ];

  for (const route of transportRoutes) {
    const createdRoute = await prisma.transportRoute.upsert({
      where: {
        id: `${demoTenant.id}:${route.name}`,
      },
      update: {
        branchId: route.branchId,
        vehicleNumber: route.vehicleNumber,
        driverName: route.driverName,
        driverPhone: route.driverPhone,
        feeAmount: new Prisma.Decimal(route.feeAmount),
        description: route.description,
        stops: route.stops as any,
        status: 'ACTIVE',
      },
      create: {
        id: `${demoTenant.id}:${route.name}`,
        tenantId: demoTenant.id,
        branchId: route.branchId,
        name: route.name,
        vehicleNumber: route.vehicleNumber,
        driverName: route.driverName,
        driverPhone: route.driverPhone,
        feeAmount: new Prisma.Decimal(route.feeAmount),
        description: route.description,
        stops: route.stops as any,
        status: 'ACTIVE',
      },
    });

    const candidates = await prisma.student.findMany({
      where: {
        tenantId: demoTenant.id,
        branchId: route.branchId,
        isActive: true,
      },
      take: 3,
      orderBy: { firstName: 'asc' },
    });

    for (const student of candidates) {
      await prisma.transportAssignment.upsert({
        where: {
          studentId: student.id,
        },
        update: {
          routeId: createdRoute.id,
          boardingStop: route.stops[0],
          endedAt: null,
        },
        create: {
          studentId: student.id,
          routeId: createdRoute.id,
          boardingStop: route.stops[0],
        },
      });
    }
  }

  console.log('✅ Transport routes and assignments Ready');

  console.log('\n🎉 PHASE-1 SEED COMPLETE\n');

  console.log('====================================');
  console.log('SUPER ADMIN');
  console.log('admin@bytebeamtech.com');
  console.log('SchoolOS@2026');
  console.log('====================================');

  console.log('SCHOOL ADMIN');
  console.log('admin@demo-school.com');
  console.log('Demo@123!');
  console.log('====================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
