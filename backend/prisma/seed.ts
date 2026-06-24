import { PrismaClient } from '@prisma/client';
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
      featureTier: 'ENTERPRISE',
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
      featureTier: 'PRO',
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
