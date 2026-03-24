import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';

import { validate } from './core/config/env.validation';

// ── Infrastructure ────────────────────────────────────────────────────────────
import { PrismaModule }  from './infra/database/prisma.module';
import { RedisModule }   from './infra/cache/redis.module';
import { QueueModule }   from './infra/queue/queue.module';
import { StorageModule } from './infra/storage/storage.module';

// ── Core — Phase 2 (active) ───────────────────────────────────────────────────
import { AuthModule }       from './core/auth/auth.module';
import { IdentityModule }   from './core/identity/identity.module';
import { RolesModule }      from './core/roles/roles.module';
import { UsersModule }      from './core/users/users.module';
import { TenantsModule }    from './core/tenants/tenants.module';
import { ComplianceModule } from './core/compliance/compliance.module';
import { TenantMiddleware } from './core/tenants/tenant.middleware';

// ── Core — Phase 3+ ───────────────────────────────────────────────────────────
import { AcademicSessionsModule } from './core/academic-sessions/academic-sessions.module';
import { CronEngineModule }       from './core/cron-engine/cron-engine.module';
// import { TelemetryModule }        from './core/telemetry/telemetry.module';
// import { RealtimeModule }         from './core/realtime/realtime.module';
import { IdempotencyModule }      from './core/idempotency/idempotency.module';
// import { SearchModule }           from './core/search/search.module';
// import { ExportModule }           from './core/export/export.module';
// import { WebhooksModule }         from './core/webhooks/webhooks.module';
// import { FraudModule }            from './core/fraud/fraud.module';
// import { LicenseModule }          from './core/license/license.module';
// import { LocalizationModule }     from './core/localization/localization.module';
// import { MessagingModule }        from './core/messaging/messaging.module';
import { NotificationsModule }    from './modules/notifications/notifications.module';
import { SchoolManagementModule }  from './modules/school-management/school-management.module';
import { FeatureFlagsModule }       from './modules/feature-flags/feature-flags.module';
import { SaasBillingModule }        from './modules/saas-billing/saas-billing.module';
import { SuperadminModule }         from './modules/superadmin/superadmin.module';
import { ReferralsModule }          from './core/referrals/referrals.module';
import { TenantsAdminModule }       from './modules/tenants/tenants-admin.module';


// ── Business Modules — Phase 3+ ───────────────────────────────────────────────
import { StudentsModule }          from './modules/students/students.module';
// import { GuardiansModule }         from './modules/guardians/guardians.module';
import { AcademicsModule }         from './modules/academics/academics.module';
import { AttendanceModule }        from './modules/attendance/attendance.module';
import { TimetableModule }         from './modules/timetable/timetable.module';
import { ExaminationsModule }      from './modules/examinations/examinations.module';
import { GradebookModule }         from './modules/gradebook/gradebook.module';
// import { ReportCardsModule }       from './modules/report-cards/report-cards.module';
import { StudentBillingModule }    from './modules/student-billing/student-billing.module';
import { TransportModule }        from './modules/transport/transport.module';
import { StaffModule }             from './modules/staff/staff.module';
import { PayrollModule }          from './modules/payroll/payroll.module';
import { AdmissionsModule }       from './modules/admissions/admissions.module';
// import { CurriculumModule }        from './modules/curriculum/curriculum.module';
import { HomeworkModule }          from './modules/homework/homework.module';
import { LibraryModule }          from './modules/library/library.module';
import { InventoryModule }         from './modules/inventory/inventory.module';
import { AccountingModule }       from './modules/accounting/accounting.module';
import { CrmModule } from './modules/crm/crm.module';
// import { VendorManagementModule }  from './modules/vendor-management/vendor-management.module';
// import { ResourceBookingModule }   from './modules/resource-booking/resource-booking.module';
import { CertificatesModule }      from './modules/certificates/certificates.module';
// import { IdCardsModule }           from './modules/id-cards/id-cards.module';
import { CommunicationModule }    from './modules/communication/communication.module';
// import { EventsModule }            from './modules/events/events.module';
// import { HealthModule }            from './modules/health/health.module';
// import { HostelModule }            from './modules/hostel/hostel.module';
// import { CanteenModule }           from './modules/canteen/canteen.module';
// import { GalleryModule }           from './modules/gallery/gallery.module';
// import { AlumniModule }            from './modules/alumni/alumni.module';
// import { SecurityModule }          from './modules/security/security.module';
// import { AiEngineModule }          from './modules/ai-engine/ai-engine.module';
// import { IntegrationsModule }      from './modules/integrations/integrations.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { BulkModule }              from './modules/bulk/bulk.module';
import { AccessControlModule }     from './modules/access-control/access-control.module';
import { HRModule }                from './modules/hr/hr.module';
import { ReceptionModule }         from './modules/reception/reception.module';
import { SupportModule }           from './modules/support/support.module';
// import { CustomFieldsModule }      from './modules/custom-fields/custom-fields.module';
// import { SystemModule }            from './modules/system/system.module';
// import { ReportingModule }         from './modules/reporting/reporting.module';
// import { ParentPortalModule }      from './modules/parent-portal/parent-portal.module';
// import { TeacherPortalModule }     from './modules/teacher-portal/teacher-portal.module';
// import { StudentPortalModule }     from './modules/student-portal/student-portal.module';
// import { VisitorManagementModule } from './modules/visitor-management/visitor-management.module';
// import { FrontOfficeModule }       from './modules/front-office/front-office.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal:    true,
      envFilePath: ['.env.development', '.env.production', '.env'],
      validate,
      cache:       true,
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000,  limit: 10  },
      { name: 'medium', ttl: 10000, limit: 50  },
      { name: 'long',   ttl: 60000, limit: 100 },
    ]),
    EventEmitterModule.forRoot({
      wildcard:     true,
      delimiter:    '.',
      maxListeners: 20,
    }),
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: {
          host:     process.env.REDIS_URL?.replace('redis://', '').split(':')[0] || 'localhost',
          port:     parseInt(process.env.REDIS_URL?.split(':')[2] || '6379'),
          password: process.env.REDIS_PASSWORD || undefined,
          db:       parseInt(process.env.REDIS_DB || '0'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail:     500,
          attempts:         3,
          backoff:          { type: 'exponential', delay: 1000 },
        },
      }),
    }),

    // ── Infrastructure ──────────────────────────────────────────────────────
    PrismaModule,
    RedisModule,
    QueueModule,
    StorageModule,

    // ── Core Phase 2 (active) ───────────────────────────────────────────────
    AuthModule,
    IdentityModule,
    RolesModule,
    UsersModule,
    TenantsModule,
    ComplianceModule,

    // ── Core Phase 3+ — uncomment when module is built ─────────────────────
        AcademicSessionsModule,
        CronEngineModule,
    // TelemetryModule,
    // RealtimeModule,
        IdempotencyModule,
    // SearchModule,
    // ExportModule,
    // WebhooksModule,
    // FraudModule,
    // LicenseModule,
    // LocalizationModule,
    // MessagingModule,
        NotificationsModule,

    // ── Business Modules Phase 3+ — uncomment when module is built ──────────
        StudentsModule,
    // GuardiansModule,
        AcademicsModule,
        AttendanceModule,
        TimetableModule,
        ExaminationsModule,
    GradebookModule,
    // ReportCardsModule,
    StudentBillingModule,
    TransportModule,
        StaffModule,
        SchoolManagementModule,
        FeatureFlagsModule,
        SaasBillingModule,
        TenantsAdminModule,
        ReferralsModule,
        SuperadminModule,
    PayrollModule,
    AdmissionsModule,
    CrmModule,
    // CurriculumModule,
    HomeworkModule,
    LibraryModule,
    InventoryModule,
    AccountingModule,
    // VendorManagementModule,
    // ResourceBookingModule,
    CertificatesModule,
    // IdCardsModule,
    CommunicationModule,
    // EventsModule,
    // HealthModule,
    // HostelModule,
    // CanteenModule,
    // GalleryModule,
    // AlumniModule,
    // SecurityModule,
    // AiEngineModule,
    // IntegrationsModule,
    OnboardingModule,
    SupportModule,
    BulkModule,
    AccessControlModule,
    HRModule,
    ReceptionModule,
    // CustomFieldsModule,
    // SystemModule,
    // ReportingModule,
    // ParentPortalModule,
    // TeacherPortalModule,
    // StudentPortalModule,
    // VisitorManagementModule,
    // FrontOfficeModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: 'health',              method: RequestMethod.GET  },
        { path: 'api/v1/health',       method: RequestMethod.GET  },
        { path: 'auth/refresh', method: RequestMethod.POST },
      )
      .forRoutes('*');
  }
}
