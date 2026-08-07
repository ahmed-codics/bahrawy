import { Global, Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { SessionAuthGuard } from './session-auth.guard';
import { StudentsController } from './students.controller';

@Global()
@Module({
  providers: [AuthService, SessionAuthGuard],
  controllers: [AuthController, StudentsController],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
