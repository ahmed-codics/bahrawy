import { Module } from '@nestjs/common';
import { AdminAuditService } from './common/services/audit.service';
import { AdminV1DashboardModule } from './dashboard/dashboard.module';
import { AdminV1AcademicModule } from './academic/academic.module';
import { AdminV1CoursesModule } from './courses/courses.module';
import { AdminV1QuestionsModule } from './questions/questions.module';
import { AdminV1ProductsModule } from './products/products.module';
import { AdminV1AssessmentsModule } from './assessments/assessments.module';
import { AdminV1StudentsModule } from './students/students.module';
import { AdminV1PaymentsModule } from './payments/payments.module';
import { AdminV1SupportModule } from './support/support.module';
import { AdminV1ManagementModule } from './management/management.module';

@Module({
  imports: [
    AdminV1DashboardModule,
    AdminV1AcademicModule,
    AdminV1CoursesModule,
    AdminV1QuestionsModule,
    AdminV1ProductsModule,
    AdminV1AssessmentsModule,
    AdminV1StudentsModule,
    AdminV1PaymentsModule,
    AdminV1SupportModule,
    AdminV1ManagementModule,
  ],
  providers: [AdminAuditService],
  exports: [AdminAuditService],
})
export class AdminV1Module {}
