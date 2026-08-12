import { test } from '@playwright/test';

const STAFF = 'http://localhost:3002';

test('capture create request', async ({ page }) => {
  page.on('request', (req) => {
    if (req.url().includes('/admin/v1/courses') || req.url().includes('/storage')) {
      console.log('REQ:', req.method(), req.url());
      if (req.method() === 'POST' && req.url().includes('/courses')) {
        console.log('  BODY:', req.postData());
      }
    }
  });
  page.on('response', (res) => {
    if (res.url().includes('/admin/v1/courses') || res.url().includes('/storage')) {
      console.log('RES:', res.status(), res.url());
    }
  });
  page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));

  await page.goto(`${STAFF}/login`);
  await page.getByLabel(/البريد الإلكتروني/i).fill('admin@bahrawy.test');
  await page.getByLabel(/كلمة المرور/i).fill('owner_secret');
  await page.getByRole('button', { name: /تسجيل الدخول|دخول/i }).first().click();
  await page.waitForTimeout(2000);
  await page.goto(`${STAFF}/dashboard/courses`);
  await page.getByRole('button', { name: /كورس جديد/i }).first().click();
  await page.waitForTimeout(500);
  await page.getByLabel('اسم الكورس بالعربية').fill('[DEV] كرس تجريبي');
  await page.getByLabel('الكود').fill('dev-cap-' + Date.now());
  await page.getByRole('button', { name: /إنشاء كمسودة/i }).click();
  await page.waitForTimeout(4000);
});
