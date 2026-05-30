import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function hash(password: string) {
return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function main() {
console.log('\n🌱 Seeding SchoolOS...\n');

// =====================================================
// SUPERADMIN TENANT
// =====================================================

const platformTenant = await prisma.tenant.upsert({
where: {
slug: 'schoolos-platform',
},
update: {},
create: {
name: 'SchoolOS Platform',
slug: 'schoolos-platform',
contactEmail: '[superadmin@schoolos.com](mailto:superadmin@schoolos.com)',
status: 'ACTIVE',
featureTier: 'ENTERPRISE',
region: 'IN',
currency: 'INR',
},
});

const superAdminPassword = await hash('SchoolOS@2024!');

await prisma.user.upsert({
where: {
tenantId_email: {
tenantId: platformTenant.id,
email: '[superadmin@schoolos.com](mailto:superadmin@schoolos.com)',
},
},
update: {
passwordHash: superAdminPassword,
},
create: {
tenantId: platformTenant.id,
email: '[superadmin@schoolos.com](mailto:superadmin@schoolos.com)',
passwordHash: superAdminPassword,
firstName: 'SchoolOS',
lastName: 'Admin',
role: 'SUPER_ADMIN',
isActive: true,
isEmailVerified: true,
},
});

console.log('✅ Superadmin ready');

// =====================================================
// DEMO TENANT
// =====================================================

const demoTenant = await prisma.tenant.upsert({
where: {
slug: 'demo-school',
},
update: {},
create: {
name: 'Demo International School',
slug: 'demo-school',
contactEmail: '[admin@demo-school.com](mailto:admin@demo-school.com)',
status: 'ACTIVE',
featureTier: 'PRO',
region: 'IN',
currency: 'INR',
},
});

const demoPassword = await hash('Demo@123!');

const demoAdmin = await prisma.user.upsert({
where: {
tenantId_email: {
tenantId: demoTenant.id,
email: '[admin@demo-school.com](mailto:admin@demo-school.com)',
},
},
update: {
passwordHash: demoPassword,
},
create: {
tenantId: demoTenant.id,
email: '[admin@demo-school.com](mailto:admin@demo-school.com)',
passwordHash: demoPassword,
firstName: 'Demo',
lastName: 'Admin',
role: 'SCHOOL_ADMIN',
isActive: true,
isEmailVerified: true,
},
});

console.log('✅ Demo admin ready');

// =====================================================
// PRIMARY BRANCH
// =====================================================

const mainBranch = await prisma.branch.upsert({
where: {
id: `br_${demoTenant.slug}_main`,
},
update: {},
create: {
id: `br_${demoTenant.slug}_main`,
tenantId: demoTenant.id,
name: 'Lucknow Main Branch',
isPrimary: true,
isActive: true,
},
});

console.log('✅ Primary branch ready');

// =====================================================
// USER BRANCH MAPPING
// =====================================================

const existingMapping = await prisma.userBranch.findFirst({
where: {
userId: demoAdmin.id,
branchId: mainBranch.id,
},
});

if (!existingMapping) {
await prisma.userBranch.create({
data: {
tenantId: demoTenant.id,
userId: demoAdmin.id,
branchId: mainBranch.id,
isDefault: true,
isActive: true,
},
});
}

console.log('✅ User branch mapping ready');

// =====================================================
// ACADEMIC SESSION
// =====================================================

await prisma.academicSession.upsert({
where: {
id: `session_${demoTenant.slug}_2026`,
},
update: {},
create: {
id: `session_${demoTenant.slug}_2026`,
tenantId: demoTenant.id,
name: '2026-27',
startDate: new Date('2026-04-01'),
endDate: new Date('2027-03-31'),
isCurrent: true,
},
});

console.log('✅ Academic session ready');

// =====================================================
// COMPLETE
// =====================================================

console.log('\n🎉 SEED COMPLETE!\n');

console.log('🔐 LOGIN DETAILS');
console.log('-----------------------------------------');
console.log('Superadmin');
console.log('Email: [superadmin@schoolos.com](mailto:superadmin@schoolos.com)');
console.log('Password: SchoolOS@2024!');
console.log('');
console.log('Demo School Admin');
console.log('Email: [admin@demo-school.com](mailto:admin@demo-school.com)');
console.log('Password: Demo@123!');
console.log('-----------------------------------------');
}

main()
.catch((e) => {
console.error('❌ Seed failed:', e);
process.exit(1);
})
.finally(async () => {
await prisma.$disconnect();
});

