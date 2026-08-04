import { Module, Global } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController, PaymentPlanController } from './payment.controller';

@Global()
@Module({
  controllers: [PaymentController, PaymentPlanController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
