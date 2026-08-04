import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionAuthGuard } from './session-auth.guard';
import { ThrottleGuard } from '../throttle/throttle.guard';
import { StudentsController } from './students.controller';

@Global()
@Module({
  providers: [AuthService, SessionAuthGuard, ThrottleGuard],
  controllers: [AuthController, StudentsController],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
