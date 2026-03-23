/**
 * SchoolOS — Master Seed Script
 * Creates: superadmin user, pricing plans, demo tenant + admin + academic session
 *
 * Run: pnpm --filter backend db:seed
 * Or:  npx ts-node --project tsconfig.json prisma/seed.ts
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key = line.slice(0, eqIndex).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

const backendRoot = path.resolve(__dirname, '..');
loadEnvFile(path.join(backendRoot, '.env.development'));
loadEnvFile(path.join(backendRoot, '.env'));

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function hash(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// ─── Config — change these before first run ───────────────────────────────
const SUPERADMIN = {
  email:     process.env.SEED_SA_EMAIL    ?? 'superadmin@schoolos.com',
  password:  process.env.SEED_SA_PASSWORD ?? 'SchoolOS@2024!',
  firstName: 'SchoolOS',
  lastName:  'Admin',
};

const DEMO_TENANT = {
  name:         process.env.SEED_DEMO_NAME     ?? 'Demo School',
  slug:         process.env.SEED_DEMO_SLUG     ?? 'demo-school',
  contactEmail: process.env.SEED_DEMO_EMAIL    ?? 'admin@demo-school.com',
  adminPassword:process.env.SEED_DEMO_PASSWORD ?? 'Demo@1234!',
};

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱 SchoolOS Seed — Starting...\n');

  // ── 1. Superadmin tenant + user ──────────────────────────────────────────
  console.log('1. Creating superadmin...');

  let saTenant = await prisma.tenant.findFirst({ where: { slug: 'schoolos-platform' } });
  if (!saTenant) {
    saTenant = await prisma.tenant.create({
      data: {
        name:         'SchoolOS Platform',
        slug:         'schoolos-platform',
        contactEmail: SUPERADMIN.email,
        status:       'ACTIVE',
        featureTier:  'ENTERPRISE',
        maxStudents:  999999,
        region:       'IN',
        currency:     'INR',
      },
    });
    console.log(`   Tenant created: ${saTenant.slug}`);
  } else {
    console.log(`   Tenant exists: ${saTenant.slug}`);
  }

  const existingSA = await prisma.user.findFirst({
    where: { email: SUPERADMIN.email, tenantId: saTenant.id },
  });

  if (!existingSA) {
    await prisma.user.create({
      data: {
        tenantId:        saTenant.id,
        email:           SUPERADMIN.email,
        passwordHash:    await hash(SUPERADMIN.password),
        firstName:       SUPERADMIN.firstName,
        lastName:        SUPERADMIN.lastName,
        role:            'SUPER_ADMIN',
        isActive:        true,
        isEmailVerified: true,
      },
    });
    console.log(`   ✓ Superadmin created: ${SUPERADMIN.email}`);
    console.log(`   ✓ Password:           ${SUPERADMIN.password}`);
  } else {
    console.log(`   Superadmin exists: ${SUPERADMIN.email}`);
  }

  // ── 2. Pricing Plans ──────────────────────────────────────────────────────
  console.log('\n2. Creating pricing plans...');

  const plans = [
    {
      name:           'Starter',
      tier:           'STARTER',
      model:          'PER_STUDENT',
      currency:       'INR',
      region:         'IN',
      perStudentRate: 30,
      studentLimit:   300,
      baseFee:        null,
      trialDays:      30,
      features:       JSON.stringify(['students', 'attendance', 'billing', 'notifications']),
    },
    {
      name:           'Growth',
      tier:           'GROWTH',
      model:          'PER_STUDENT',
      currency:       'INR',
      region:         'IN',
      perStudentRate: 50,
      studentLimit:   1000,
      baseFee:        null,
      trialDays:      30,
      features:       JSON.stringify(['students','attendance','billing','notifications','exams','library','transport','communication']),
    },
    {
      name:           'Pro',
      tier:           'PRO',
      model:          'HYBRID',
      currency:       'INR',
      region:         'IN',
      baseFee:        4999,
      perStudentRate: 30,
      studentLimit:   3000,
      trialDays:      14,
      features:       JSON.stringify(['all_features','analytics','api_access','priority_support']),
    },
    {
      name:           'Enterprise',
      tier:           'ENTERPRISE',
      model:          'SUBSCRIPTION',
      currency:       'INR',
      region:         'IN',
      baseFee:        29999,
      perStudentRate: null,
      studentLimit:   null,
      trialDays:      0,
      features:       JSON.stringify(['all_features','analytics','api_access','dedicated_support','custom_domain','sso']),
    },
    // USD plans for international
    {
      name:           'Starter (USD)',
      tier:           'STARTER',
      model:          'PER_STUDENT',
      currency:       'USD',
      region:         'US',
      perStudentRate: 0.5,
      studentLimit:   300,
      baseFee:        null,
      trialDays:      30,
      features:       JSON.stringify(['students', 'attendance', 'billing', 'notifications']),
    },
    {
      name:           'Growth (USD)',
      tier:           'GROWTH',
      model:          'PER_STUDENT',
      currency:       'USD',
      region:         'US',
      perStudentRate: 1,
      studentLimit:   1000,
      baseFee:        null,
      trialDays:      30,
      features:       JSON.stringify(['students','attendance','billing','notifications','exams','library','transport']),
    },
  ];

  for (const plan of plans) {
    const existing = await prisma.pricingPlan.findFirst({
      where: { name: plan.name, currency: plan.currency as any },
    });
    if (!existing) {
      await prisma.pricingPlan.create({ data: plan as any });
      console.log(`   ✓ Plan: ${plan.name} (${plan.currency})`);
    } else {
      console.log(`   Plan exists: ${plan.name}`);
    }
  }

  // ── 3. Demo Tenant ────────────────────────────────────────────────────────
  console.log('\n3. Creating demo tenant...');

  let demoTenant = await prisma.tenant.findFirst({ where: { slug: DEMO_TENANT.slug } });

  if (!demoTenant) {
    demoTenant = await prisma.tenant.create({
      data: {
        name:         DEMO_TENANT.name,
        slug:         DEMO_TENANT.slug,
        contactEmail: DEMO_TENANT.contactEmail,
        status:       'TRIAL',
        featureTier:  'GROWTH',
        maxStudents:  1000,
        region:       'IN',
        currency:     'INR',
        contactPhone: '+919999999999',
      },
    });
    console.log(`   ✓ Tenant created: ${demoTenant.slug}`);
  } else {
    console.log(`   Tenant exists: ${demoTenant.slug}`);
  }

  // Demo tenant subscription (TRIAL on Growth plan)
  const growthPlan = await prisma.pricingPlan.findFirst({
    where: { tier: 'GROWTH', currency: 'INR' },
  });
  if (growthPlan) {
    const existingSub = await prisma.tenantSubscription.findFirst({
      where: { tenantId: demoTenant.id },
    });
    if (!existingSub) {
      const now      = new Date();
      const trialEnd = new Date(now.getTime() + 30 * 86400000);
      await prisma.tenantSubscription.create({
        data: {
          tenantId:           demoTenant.id,
          planId:             growthPlan.id,
          model:              'PER_STUDENT',
          status:             'TRIAL',
          currency:           'INR',
          currentPeriodStart: now,
          currentPeriodEnd:   trialEnd,
          trialEndsAt:        trialEnd,
        },
      });
      console.log(`   ✓ Trial subscription: Growth plan (30 days)`);
    }
  }

  // Demo admin user
  const existingAdmin = await prisma.user.findFirst({
    where: { email: DEMO_TENANT.contactEmail, tenantId: demoTenant.id },
  });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        tenantId:        demoTenant.id,
        email:           DEMO_TENANT.contactEmail,
        passwordHash:    await hash(DEMO_TENANT.adminPassword),
        firstName:       'School',
        lastName:        'Admin',
        role:            'SCHOOL_ADMIN',
        isActive:        true,
        isEmailVerified: true,
      },
    });
    console.log(`   ✓ Admin user: ${DEMO_TENANT.contactEmail}`);
    console.log(`   ✓ Password:   ${DEMO_TENANT.adminPassword}`);
  } else {
    console.log(`   Admin exists: ${DEMO_TENANT.contactEmail}`);
  }

  // Demo academic session
  const existingSession = await prisma.academicSession.findFirst({
    where: { tenantId: demoTenant.id },
  });
  if (!existingSession) {
    const year = new Date().getFullYear();
    await prisma.academicSession.create({
      data: {
        tenantId:  demoTenant.id,
        name:      `${year}-${year + 1}`,
        startDate: new Date(`${year}-04-01`),
        endDate:   new Date(`${year + 1}-03-31`),
        isCurrent: true,
        isLocked:  false,
      },
    });
    console.log(`   ✓ Academic session: ${year}-${year + 1}`);
  }

  // ── 4. Default Permissions ────────────────────────────────────────────────
  console.log('\n4. Seeding permissions...');

  const defaultPermissions = [
    // Students
    { module: 'students', action: 'view' },
    { module: 'students', action: 'create' },
    { module: 'students', action: 'edit' },
    { module: 'students', action: 'delete' },
    // Attendance
    { module: 'attendance', action: 'view' },
    { module: 'attendance', action: 'mark' },
    // Billing
    { module: 'billing', action: 'view' },
    { module: 'billing', action: 'create_invoice' },
    { module: 'billing', action: 'record_payment' },
    { module: 'billing', action: 'apply_discount' },
    // Exams
    { module: 'exams', action: 'view' },
    { module: 'exams', action: 'create' },
    { module: 'exams', action: 'enter_marks' },
    // Staff
    { module: 'staff', action: 'view' },
    { module: 'staff', action: 'create' },
    { module: 'staff', action: 'edit' },
    // HR
    { module: 'hr', action: 'view' },
    { module: 'hr', action: 'approve_leave' },
    { module: 'hr', action: 'manage_joining' },
    // Reports
    { module: 'reports', action: 'view' },
    { module: 'reports', action: 'export' },
    // Settings
    { module: 'settings', action: 'view' },
    { module: 'settings', action: 'edit' },
  ];

  let created = 0;
  for (const perm of defaultPermissions) {
    const existing = await prisma.permission.findUnique({
      where: { module_action: perm },
    });
    if (!existing) {
      await prisma.permission.create({ data: perm });
      created++;
    }
  }
  console.log(`   ✓ ${created} permissions created (${defaultPermissions.length - created} already existed)`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('✅ Seed complete!\n');
  console.log('SUPERADMIN LOGIN:');
  console.log(`  School ID : schoolos-platform`);
  console.log(`  Email     : ${SUPERADMIN.email}`);
  console.log(`  Password  : ${SUPERADMIN.password}`);
  console.log(`  URL       : http://localhost:3001  (superadmin app)`);
  console.log('');
  console.log('DEMO SCHOOL LOGIN:');
  console.log(`  School ID : ${DEMO_TENANT.slug}`);
  console.log(`  Email     : ${DEMO_TENANT.contactEmail}`);
  console.log(`  Password  : ${DEMO_TENANT.adminPassword}`);
  console.log(`  URL       : http://localhost:4000  (frontend app)`);
  console.log('─'.repeat(60) + '\n');
}

main()
  .catch(e => { console.error('\n❌ Seed failed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
