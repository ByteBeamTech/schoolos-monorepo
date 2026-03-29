import { RawBodyMiddleware } from './common/middleware/raw-body.middleware';
import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { ClsModule } from 'nestjs-cls';
import { validate } from './core/config/env.validation';
import { TenantMiddleware } from './core/tenants/tenant.middleware';

import { PrismaModule } from './infra/database/prisma.module';
import { RedisModule } from './infra/cache/redis.module';
import { QueueModule } from './infra/queue/queue.module';
import { StorageModule } from './infra/storage/storage.module';

import { AuthModule } from './core/auth/auth.module';
import { IdentityModule } from './core/identity/identity.module';
import { RolesModule } from './core/roles/roles.module';
import { UsersModule } from './core/users/users.module';
import { TenantsModule } from './core/tenants/tenants.module';
import { ComplianceModule } from './core/compliance/compliance.module';

import { AcademicSessionsModule } from './core/academic-sessions/academic-sessions.module';
import { CronEngineModule } from './core/cron-engine/cron-engine.module';
import { IdempotencyModule } from './core/idempotency/idempotency.module';
import { ReferralsModule } from './core/referrals/referrals.module';

import { NotificationsModule } from './modules/notifications/notifications.module';
import { SchoolManagementModule } from './modules/school-management/school-management.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { SaasBillingModule } from './modules/saas-billing/saas-billing.module';
import { SuperadminModule } from './modules/superadmin/superadmin.module';
import { TenantsAdminModule } from './modules/tenants/tenants-admin.module';
import { StudentsModule } from './modules/students/students.module';
import { AcademicsModule } from './modules/academics/academics.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { TimetableModule } from './modules/timetable/timetable.module';
import { ExaminationsModule } from './modules/examinations/examinations.module';
import { GradebookModule } from './modules/gradebook/gradebook.module';
import { StudentBillingModule } from './modules/student-billing/student-billing.module';
import { TransportModule } from './modules/transport/transport.module';
import { StaffModule } from './modules/staff/staff.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { AdmissionsModule } from './modules/admissions/admissions.module';
import { HomeworkModule } from './modules/homework/homework.module';
import { LibraryModule } from './modules/library/library.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { CrmModule } from './modules/crm/crm.module';
import { CertificatesModule } from './modules/certificates/certificates.module';
import { CommunicationModule } from './modules/communication/communication.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { BulkModule } from './modules/bulk/bulk.module';
import { AccessControlModule } from './modules/access-control/access-control.module';
import { HRModule } from './modules/hr/hr.module';
import { ReceptionModule } from './modules/reception/reception.module';
import { SupportModule } from './modules/support/support.module';
import { BehaviorModule } from './modules/behavior/behavior.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env.production', '.env'],
      validate,
      cache: true,
    }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true, generateId: true },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 100 },
    ]),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.', maxListeners: 20 }),
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host: process.env.REDIS_URL?.replace('redis://', '').split(':')[0] || 'localhost',
          port: parseInt(process.env.REDIS_URL?.split(':')[2] || '6379'),
        },
      }),
    }),
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,
    AuthModule,
    IdentityModule,
    RolesModule,
    UsersModule,
    TenantsModule,
    ComplianceModule,
    AcademicSessionsModule,
    CronEngineModule,
    IdempotencyModule,
    ReferralsModule,
    NotificationsModule,
    SchoolManagementModule,
    FeatureFlagsModule,
    SaasBillingModule,
    SuperadminModule,
    TenantsAdminModule,
    StudentsModule,
    AcademicsModule,
    AttendanceModule,
    TimetableModule,
    ExaminationsModule,
    GradebookModule,
    StudentBillingModule,
    TransportModule,
    StaffModule,
    PayrollModule,
    AdmissionsModule,
    HomeworkModule,
    LibraryModule,
    InventoryModule,
    AccountingModule,
    CrmModule,
    CertificatesModule,
    CommunicationModule,
    OnboardingModule,
    BulkModule,
    AccessControlModule,
    HRModule,
    ReceptionModule,
    SupportModule,
    BehaviorModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // 1. RAW BODY MIDDLEWARE (Phase 1 Fix)
    // Isko sabse upar rakhna hai taaki webhooks ka original data preserve ho sake
    consumer
      .apply(RawBodyMiddleware)
      .forRoutes('webhooks/(.*)');

    // 2. TENANT MIDDLEWARE (Standard logic)
    // Ensure karna ki webhooks excluded rahein warna 'x-tenant-id' missing ka error aayega
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        'auth/(.*)',
        'webhooks/(.*)', // Webhooks tenant-agnostic hote hain, isliye exclude zaroori hai
      )
      .forRoutes('*');
  }
}
