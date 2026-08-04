import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SecurityModule } from './security/security.module';
import { TotpModule } from './totp/totp.module';
import { RbacModule } from './rbac/rbac.module';
import { StaffAccessModule } from './staff-access/staff-access.module';
import { AuthModule } from './auth/auth.module';
import { DeviceLeaseModule } from './device-lease/device-lease.module';
import { CatalogModule } from './catalog/catalog.module';
import { StorageModule } from './storage/storage.module';
import { PaymentModule } from './payment/payment.module';
import { AssessmentModule } from './assessment/assessment.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { SupportModule } from './support/support.module';
import { NotificationModule } from './notification/notification.module';
import { VideoModule } from './video/video.module';
import { AdminCatalogModule } from './admin-catalog/admin-catalog.module';
import { AdminAssessmentModule } from './admin-assessment/admin-assessment.module';
import { AdminContentModule } from './admin-content/admin-content.module';
import { AdminV1Module } from './admin-v1/admin-v1.module';
import { CsrfModule } from './csrf/csrf.module';

import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './rbac/audit.interceptor';
import { CsrfGuard } from './csrf/csrf.guard';

@Module({
  imports: [
    SecurityModule,
    TotpModule,
    RbacModule,
    StaffAccessModule,
    AuthModule,
    DeviceLeaseModule,
    CatalogModule,
    StorageModule,
    PaymentModule,
    AssessmentModule,
    DashboardModule,
    SupportModule,
    NotificationModule,
    VideoModule,
    AdminCatalogModule,
    AdminAssessmentModule,
    AdminContentModule,
    AdminV1Module,
    CsrfModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
