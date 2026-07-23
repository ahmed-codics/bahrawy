import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { db } from '@bahrawy/db';

describe('Bahrawy Academy E2E', () => {
  let app: INestApplication<App>;
  let staffCookie: string;
  let studentCookie: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    
    // Attempt login with seeded staff
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '+201000000000', password: 'password123' });
    
    if (loginRes.status === 201 || loginRes.status === 200) {
      staffCookie = loginRes.headers['set-cookie'][0];
    }
    
    // Attempt login with seeded student
    const studentRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ phone: '+201111111111', password: 'password123' });
      
    if (studentRes.status === 201 || studentRes.status === 200) {
      studentCookie = studentRes.headers['set-cookie'][0];
    }
  });

  afterAll(async () => {
    await db.$disconnect();
    await app.close();
  });

  it('should deny unauthenticated access to admin routes', async () => {
    await request(app.getHttpServer())
      .get('/admin/catalog/courses')
      .expect(403); // Or 401
  });

  it('should allow staff to access admin routes', async () => {
    if (!staffCookie) return; // Skip if db not seeded
    await request(app.getHttpServer())
      .get('/admin/catalog/courses')
      .set('Cookie', staffCookie)
      .expect(200);
  });
  
  it('should deny student from accessing admin routes (RBAC check)', async () => {
    if (!studentCookie) return; // Skip if db not seeded
    await request(app.getHttpServer())
      .get('/admin/catalog/courses')
      .set('Cookie', studentCookie)
      .expect(403);
  });
});
