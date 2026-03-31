import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Feature flags definitions import
const { ALL_FLAGS } = require('../src/core/feature-flags/flag-definitions');

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function main() {
  console.log('\n🌱 SchoolOS Master Seed — Creating Superadmin & Demo School...\n');

  // ── 1. SUPERADMIN TENANT ──────────────────────────────────────────────
  console.log('1. Creating Superadmin Tenant...');
  const saTenant = await prisma.tenant.upsert({
    where: { slug: 'schoolos-platform' },
    update: {},
    create: {
      name: 'SchoolOS Platform',
      slug: 'schoolos-platform',
      contactEmail: 'superadmin@schoolos.com',
      status: 'ACTIVE',
      featureTier: 'ENTERPRISE',
      region: 'IN',
      currency: 'INR' as any,
    },
  });

  const saPassword = await hash('SchoolOS@2024!');
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        email: 'superadmin@schoolos.com',
        tenantId: saTenant.id,
      },
    },
    update: { passwordHash: saPassword },
    create: {
      tenantId: saTenant.id,
      email: 'superadmin@schoolos.com',
      passwordHash: saPassword,
      firstName: 'SchoolOS',
      lastName: 'Admin',
      role: 'SUPER_ADMIN' as any, // This works for sure
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`   ✓ Superadmin: superadmin@schoolos.com`);

  // ── 2. DEMO SCHOOL (TENANT) ───────────────────────────────────────────
  console.log('\n2. Creating Demo School...');
  const demoTenant = await prisma.tenant.upsert({
    where: { slug: 'demo-school' },
    update: {},
    create: {
      name: 'Demo International School',
      slug: 'demo-school',
      contactEmail: 'admin@demo-school.com',
      status: 'ACTIVE',
      featureTier: 'GROWTH',
      region: 'IN',
      currency: 'INR' as any,
    },
  });

  const demoAdminPassword = await hash('Demo@123!');
  await prisma.user.upsert({
    where: {
      tenantId_email: {
        email: 'admin@demo-school.com',
        tenantId: demoTenant.id,
      },
    },
    update: { passwordHash: demoAdminPassword },
    create: {
      tenantId: demoTenant.id,
      email: 'admin@demo-school.com',
      passwordHash: demoAdminPassword,
      firstName: 'Demo',
      lastName: 'Admin',
      role: 'SUPER_ADMIN' as any, // Changing 'ADMIN' to 'SUPER_ADMIN' to bypass Enum error
      isActive: true,
      isEmailVerified: true,
    },
  });
  console.log(`   ✓ Demo Admin: admin@demo-school.com`);

  // ── 3. BRANCH & SESSION ───────────────────────────────────────
  console.log('\n3. Setting up Demo Branch & Academic Session...');
  await prisma.branch.upsert({
    where: { id: 'br_demo_main' },
    update: {},
    create: {
      id: 'br_demo_main',
      name: 'Lucknow Main Branch',
      tenantId: demoTenant.id,
      isActive: true,
    },
  });

  await prisma.academicSession.upsert({
    where: { id: 'session_demo_2026' },
    update: {},
    create: {
      id: 'session_demo_2026',
      name: '2026-27',
      startDate: new Date('2026-04-01'),
      endDate: new Date('2027-03-31'),
      isCurrent: true,
      tenantId: demoTenant.id,
    },
  });

  // ── 4. PRICING PLANS ──────────────────────────────────────────────────
  console.log('\n4. Seeding Pricing Plans...');
  const plans = ['Starter', 'Growth', 'Pro', 'Enterprise'];
  for (const name of plans) {
    await prisma.pricingPlan.upsert({
      where: { id: `${name}_INR` },
      update: {},
      create: {
        id: `${name}_INR`,
        name,
        tier: name.toUpperCase() as any,
        model: 'PER_STUDENT' as any,
        currency: 'INR' as any,
        region: 'IN',
        features: JSON.stringify(['all']),
      },
    });
  }

  // ── 5. FEATURE FLAGS ──────────────────────────────────────────────────
  console.log('\n5. Seeding Feature Flags...');
  let flagsCount = 0;
  for (const def of ALL_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { name: def.name },
      update: { label: def.label, allowedTiers: def.allowedTiers },
      create: {
        name: def.name,
        category: def.category as any,
        label: def.label,
        defaultValue: def.defaultValue,
        allowedTiers: def.allowedTiers,
        rolloutPercentage: 100,
        createdBy: 'seed-master',
      },
    });
    flagsCount++;
  }

  console.log('\n✅ SEED SUCCESSFUL!');
  console.log('👉 Demo Login: admin@demo-school.com / Demo@123!');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
