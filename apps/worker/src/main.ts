import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import '@bahrawy/config';

async function bootstrap() {
  await NestFactory.createApplicationContext(AppModule);
}
void bootstrap();
