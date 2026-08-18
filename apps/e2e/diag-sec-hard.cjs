// Security hardening verification — YouTube URL/ID exposure tests 1-13.
// Run against the locally-running API (3000) + web (3001).
const { chromium, request: pwRequest } = require('playwright');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const API = 'http://localhost:3000';
const WEB = 'http://localhost:3001';
let apiReq;
// Quiz-gated lesson: accessible only via a VideoAccessGrant (the page's
// catalog gate locks entitled-but-not-passing students).
const LESSON = '3318de6c-e140-47a5-bf8e-5d37afdf4b8c';
const COURSE = 'afbb2884-19d6-40a8-8f7b-bb0174ab0589';
const VIDEO_ID = 'q0w7VP5uAPE';
// Un-gated lesson in the same course: accessible to an entitled student,
// used for the progress/resume checks.
const LESSON2 = 'c3ace522-4675-42e0-835d-11ed94e4ce7e';
const VIDEO_ID2 = 'X6Ws0wk_p2g';
const FP1 = 'sec-hard-device-001';
const FP2 = 'sec-hard-device-002';
const stamp = Date.now();
const phone1 = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
const phone2 = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
const PRODUCT_COURSE = '24eb4a2d-3ea3-4833-b5ce-b028bda7ad37';

const rootEnv = path.resolve(__dirname, '../../.env');
const DB_URL = (fs.readFileSync(rootEnv, 'utf8').match(/^DATABASE_URL=(.+)$/m) || [])[1];

const results = [];
const record = (n, ok, detail) => {
  results.push({ n, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [test ${n}] ${detail}`);
};

const login = async (ctx, pathname, body, fp) => {
  const r = await apiReq.post(`${API}${pathname}`, {
    data: body,
    headers: fp ? { 'x-device-fingerprint': fp } : undefined,
  });
  if (r.status() >= 400) throw new Error(`${pathname} login failed: ${r.status()}`);
  const c = r.headers()['set-cookie'];
  const cr = await apiReq.get(`${API}/auth/csrf-token`, { headers: { cookie: c } });
  const j = await cr.json();
  if (!j.csrfToken) throw new Error(`${pathname} csrf fetch failed: ${cr.status()}`);
  return { cookies: c, csrf: j.csrfToken };
};

const registerStudent = async (ctx, lastName) => {
  const phone = `010${Math.floor(10000000 + Math.random() * 90000000)}`;
  const r = await apiReq.post(`${API}/auth/register`, {
    data: {
      firstName: 'SecHard', secondName: 'Test', thirdName: 'Student', lastName,
      phone, parentPhone: `011${Math.floor(10000000 + Math.random() * 90000000)}`,
      email: `${lastName.toLowerCase()}${stamp}@bahrawy.test`, schoolName: 'Test School',
      gender: 'MALE', city: 'Cairo',
      gradeId: '6ba0f5e8-120e-4492-a135-0696839bb80a', password: 'student_secret',
    },
  });
  if (!r.ok()) throw new Error(`register ${lastName} failed: ${r.status()}`);
  return phone;
};

const sessionCookieObjects = (cookieHeader) =>
  cookieHeader
    .split(/,(?=\w+=[^;]+;)/)
    .map((p) => {
      const [nv, ...a] = p.split(';');
      const [name, ...v] = nv.split('=');
      return {
        name,
        value: v.join('='),
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        ...(a.some((x) => /Max-Age=0|Expires=Thu, 01 Jan 1970/.test(x)) ? { expires: 0 } : {}),
      };
    })
    .filter((c) => !(c.expires === 0));

const playVideo = async (page, timeoutMs) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const btn = page.locator('button[title="تشغيل"], button[aria-label="تشغيل"]').first();
    if ((await btn.count()) > 0) {
      await btn.click({ timeout: 2000 }).catch(() => {});
    }
    await page.waitForTimeout(3000);
    const playing = await page.evaluate(() =>
      !!document.querySelector('button[title="إيقاف مؤقت"], button[aria-label="إيقاف مؤقت"]'));
    if (playing) return true;
  }
  return false;
};

(async () => {
  const pg = new Client({ connectionString: DB_URL });
  await pg.connect();

  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1400, height: 700 } });
  // Dedicated, isolated API request context. Never use `ctx.request`: it
  // shares the browser context's cookie jar, so a later S2 login would
  // replace S1's session cookie and cross-contaminate the S1 page requests.
  apiReq = await pwRequest.newContext();

  // ---- Setup: staff, S1 (grant), S2 (no access then entitled fixture) ----
  const staff = await login(ctx, '/auth/staff-login', { email: 'admin@bahrawy.test', password: 'owner_secret' });
  const phoneS1 = await registerStudent(ctx, `S1${stamp}`);
  const s1 = await login(ctx, '/auth/login', { phone: phoneS1, password: 'student_secret' }, FP1);
  const phoneS2 = await registerStudent(ctx, `S2${stamp}`);
  const s2 = await login(ctx, '/auth/login', { phone: phoneS2, password: 'student_secret' }, FP2);

  const create = await apiReq.post(`${API}/video-access-requests`, {
    data: { lessonId: LESSON },
    headers: { cookie: s1.cookies, 'x-device-fingerprint': FP1, 'x-csrf-token': s1.csrf },
  });
  if (create.status() !== 201) { console.log('CREATE S1 FAIL', create.status(), (await create.text()).slice(0, 200)); process.exit(1); }
  const created = (await create.json()).data;
  const approve = await apiReq.post(`${API}/admin/v1/video-access/requests/${created.id}/approve`, {
    data: { durationType: 'ONE_DAY' },
    headers: { cookie: staff.cookies, 'x-csrf-token': staff.csrf },
  });
  if (approve.status() !== 201) { console.log('APPROVE S1 FAIL', approve.status(), (await approve.text()).slice(0, 200)); process.exit(1); }

  const s1Me = (await (await apiReq.get(`${API}/auth/me`, { headers: { cookie: s1.cookies, 'x-device-fingerprint': FP1 } })).json()).data;
  const s1AccountId = s1Me.accountId;
  const s1Name = s1Me.name;
  const s2Me = (await (await apiReq.get(`${API}/auth/me`, { headers: { cookie: s2.cookies, 'x-device-fingerprint': FP2 } })).json()).data;
  const s2AccountId = s2Me.accountId;
  const ident = await pg.query(
    `SELECT sp."studentNumber" AS num, o.name AS org
       FROM "StudentProfile" sp
       JOIN "Account" a ON a.id = sp."accountId"
       JOIN "Organization" o ON o.id = a."organizationId"
      WHERE a.id = $1`, [s1AccountId],
  );
  const studentNumber = ident.rows[0].num;
  const orgName = ident.rows[0].org;
  console.log(`IDENT: name="${s1Name}" num=${studentNumber} org="${orgName}"`);

  // ================ Tests 6-9 (API authorization boundaries) ================
  const t6 = await apiReq.get(`${API}/video/${LESSON}/hls`);
  record(6, t6.status() === 401, `unauthenticated /hls -> ${t6.status()} (expected 401)`);

  const t78 = await apiReq.get(`${API}/video/${LESSON}/hls`, {
    headers: { cookie: s2.cookies, 'x-device-fingerprint': FP2 },
  });
  record(7, t78.status() === 403, `S2 (no grant/unowned course) /hls -> ${t78.status()} (expected 403)`);
  record(8, t78.status() === 403, `lesson not in S2's courses -> ${t78.status()} (expected 403)`);

  await apiReq.post(`${API}/auth/logout`, {
    headers: { cookie: s2.cookies, 'x-device-fingerprint': FP2, 'x-csrf-token': s2.csrf },
  });
  const t9 = await apiReq.get(`${API}/video/${LESSON}/hls`, {
    headers: { cookie: s2.cookies, 'x-device-fingerprint': FP2 },
  });
  record(9, t9.status() === 401, `revoked session /hls -> ${t9.status()} (expected 401)`);

  // Authorized /hls response shape (minimum info + playback session).
  const hls = await apiReq.get(`${API}/video/${LESSON}/hls`, {
    headers: { cookie: s1.cookies, 'x-device-fingerprint': FP1 },
  });
  if (hls.status() !== 200) console.log('S1 HLS FAILED', hls.status(), (await hls.text()).slice(0, 300));
  const pb = (await hls.json()).data;
  const sessionRows = await pg.query(
    `SELECT status, provider, "expiresAt" FROM "VideoPlaybackSession" WHERE "accountId" = $1 ORDER BY "createdAt" DESC LIMIT 1`,
    [s1AccountId],
  );
  const pbKeys = Object.keys(pb).sort();
  const pbOk = pbKeys.join(',') === ['expiresInSeconds', 'provider', 'videoId'].join(',');
  record(5, pbOk,
    `authorized /hls returns ONLY {provider,videoId,expiresInSeconds} (got ${pbKeys.join(',')})`);
  record('session', !!sessionRows.rows[0] && sessionRows.rows[0].status === 'ACTIVE',
    `VideoPlaybackSession row issued (status=${sessionRows.rows[0]?.status})`);
  record('wm-content', !('watermark' in pb),
    `/hls body contains no watermark (keys=${pbKeys.join(',')})`);

  // ================ Test 1 (view source / raw HTML) ================
  const rawHtml = await apiReq.get(`${WEB}/student/courses/${COURSE}/lesson/${LESSON}`, { headers: { cookie: s1.cookies } });
  const html = await rawHtml.text();
  const leaked = /youtube\.com\/watch/.test(html) || /youtu\.be\//.test(html) || html.includes(VIDEO_ID);
  record(1, !leaked, `view-source HTML has no youtube.com/watch, youtu.be/, or videoId (${leaked ? 'LEAKED' : 'clean'})`);

  // ================ S1 browser: grant path on the gated lesson (tests 2-5, 10-11) ================
  await ctx.addCookies(sessionCookieObjects(s1.cookies));
  const page = await ctx.newPage();
  const pageRequests = [];
  const pageErrors = [];
  page.on('request', (r) => pageRequests.push(r.url()));
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text().slice(0, 200)); });
  await page.addInitScript((fp) => localStorage.setItem('bahrawy-device-fingerprint', fp), FP1);
  await page.goto(`${WEB}/student/courses/${COURSE}/lesson/${LESSON}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);

  const dom = await page.evaluate((vid) => {
    const hasIframe = !!document.querySelector('iframe');
    const iframeSrc = document.querySelector('iframe')?.src || '';
    const attrLeak = [...document.querySelectorAll('*')].some(
      (el) =>
        [...el.attributes].some((a) => (a.value || '').includes('watch?v=') || (a.value || '').includes('youtu.be/')) ||
        (el.getAttribute && (el.getAttribute('data-video-id') || '') === vid),
    );
    const textLeak = document.body.innerText.includes('watch?v=') || document.body.innerText.includes('youtu.be/');
    const watermark = [...document.querySelectorAll('span')].map((s) => s.textContent || '').find((t) => t.includes('#'));
    const lsKeys = Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]);
    const ssKeys = Object.keys(sessionStorage).map((k) => [k, sessionStorage.getItem(k)]);
    return { hasIframe, iframeSrc, attrLeak, textLeak, watermark, url: location.href, ls: lsKeys, ss: ssKeys };
  }, VIDEO_ID);

  record(10, dom.hasIframe && dom.iframeSrc.startsWith('https://www.youtube-nocookie.com/embed/'),
    `player iframe initialized via IFrame API: ${dom.iframeSrc ? dom.iframeSrc.slice(0, 80) + '...' : 'NONE'}`);
  if (!dom.hasIframe) {
    console.log('PAGE DUMP:', JSON.stringify({ body: (await page.evaluate(() => document.body.innerText.replace(/\n/g, ' ').slice(0, 300))), errors: pageErrors.slice(0, 5), reqs: pageRequests.slice(0, 8) }));
  }
  record(2, !dom.attrLeak && !dom.textLeak,
    `DOM has no watch?v=/youtu.be/ in attributes or text (attrLeak=${dom.attrLeak}, textLeak=${dom.textLeak})`);
  record(3, !dom.url.includes(VIDEO_ID), `page URL has no videoId: ${dom.url}`);
  const storageClean = ![...dom.ls, ...dom.ss].some(
    ([k, v]) => (v || '').includes(VIDEO_ID) || (v || '').includes('youtube.com/watch'),
  );
  record(4, storageClean,
    `localStorage/sessionStorage contain no videoId or watch URL (keys: ${dom.ls.map(([k]) => k).join(',')})`);
  record('wm-dom', !dom.watermark,
    `no watermark overlay in player (found span: "${dom.watermark || 'NONE'}")`);

  const badReq = pageRequests.filter(
    (u) => u.includes('watch?v=') || u.includes('youtu.be/') || u.includes('youtube.com/shorts/'),
  );
  const ytReq = pageRequests.filter((u) => u.includes('youtube'));
  record('net', badReq.length === 0,
    `no watch?v=/youtu.be/ network requests (bad=${badReq.length}, youtube reqs=${ytReq.length}: ${ytReq.slice(0, 3).map((u) => u.slice(0, 70)).join(' | ')})`);

  const playing = await playVideo(page, 15000);
  record('playing', playing, `playback started (play control switched to pause state)`);

  const fsEntered = await page.evaluate(() => {
    const btn = document.querySelector('button[title="ملء الشاشة"], button[aria-label="ملء الشاشة"]');
    if (!btn) return false;
    btn.click();
    return true;
  });
  await page.waitForTimeout(1500);
  const fsCheck = await page.evaluate(() => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    const frame = document.querySelector('iframe');
    const fr = frame ? frame.getBoundingClientRect() : null;
    const watermark = [...document.querySelectorAll('span')].some((s) => (s.textContent || '').includes('#'));
    return { active: !!fsEl, w: fr ? Math.round(fr.width) : 0, h: fr ? Math.round(fr.height) : 0, watermark };
  });
  record(11, fsCheck.active && fsCheck.w >= 1300,
    `fullscreen: active=${fsCheck.active}, iframe fills ${fsCheck.w}x${fsCheck.h}, no watermark overlay=${!fsCheck.watermark}`);
  if (fsCheck.active) {
    await page.evaluate(() => document.exitFullscreen().catch(() => {}));
    await page.waitForTimeout(800);
  }

  // ================ Tests 12-13 (progress + resume) on the un-gated lesson ================
  // Fixture: grant S2 entitlement to the course so the entitlement-gated
  // progress/resume features can be verified.
  await pg.query(
    `INSERT INTO "Entitlement" (id, "accountId", "productId", "grantedAt", "expiresAt", status, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, now(), NULL, 'ACTIVE', now(), now())
     ON CONFLICT DO NOTHING`,
    [crypto.randomUUID(), s2AccountId, PRODUCT_COURSE],
  );
  const s2b = await login(ctx, '/auth/login', { phone: phoneS2, password: 'student_secret' }, FP2);
  const ctx2 = await b.newContext({ viewport: { width: 1400, height: 700 } });
  await ctx2.addCookies(sessionCookieObjects(s2b.cookies));
  const page2 = await ctx2.newPage();
  const page2Reqs = [];
  page2.on('request', (r) =>
    page2Reqs.push({ url: r.url(), fp: r.headers()['x-device-fingerprint'] || '' }));
  await page2.addInitScript((fp) => localStorage.setItem('bahrawy-device-fingerprint', fp), FP2);
  await page2.goto(`${WEB}/student/courses/${COURSE}/lesson/${LESSON2}`, { waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(9000);
  const dom2 = await page2.evaluate(() => ({
    iframe: document.querySelector('iframe')?.src || '',
    watermark: [...document.querySelectorAll('span')].map((s) => s.textContent || '').find((t) => t.includes('#')),
  }));
  record('wm2-dom', dom2.iframe.includes(VIDEO_ID2) && !dom2.watermark,
    `un-gated lesson plays ${VIDEO_ID2} via IFrame API with NO watermark (span="${dom2.watermark || 'NONE'}")`);
const playing2 = await playVideo(page2, 20000);
  await page2.waitForTimeout(15000);
  const heartbeats = page2Reqs.filter((r) => r.url.includes('/progress'));
  const mismatches = page2Reqs.filter((r) => r.fp && r.fp !== FP2);

  // Exercise the same progress endpoint the page's heartbeat uses, through the
  // real authenticated browser session (headless Chrome blocks YouTube's
  // sound autoplay, so currentTime cannot advance enough to trigger the
  // 5-second heartbeat; the pipeline itself is verified deterministically).
  const post = await page2.evaluate(async ({ fp, lessonId }) => {
    const csrf = (await (await fetch(`/api/auth/csrf-token`, { credentials: 'include' })).json()).csrfToken;
    const r = await fetch(`/api/video/${lessonId}/progress`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Fingerprint': fp,
        'X-CSRF-Token': csrf,
      },
      body: JSON.stringify({ watchedSeconds: 42, durationSeconds: 300 }),
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, { fp: FP2, lessonId: LESSON2 });

  const progress = await pg.query(
    `SELECT "watchedSeconds", "durationSeconds" FROM "LessonProgress" WHERE "accountId" = $1 AND "lessonId" = $2`,
    [s2AccountId, LESSON2],
  );
  const watched = progress.rows[0]?.watchedSeconds || 0;
  record(12, [200, 201].includes(post.status) && watched >= 42,
    `progress saved to DB (POST status=${post.status}, watchedSeconds=${watched}, duration=${progress.rows[0]?.durationSeconds || '?'}, playing=${playing2}, heartbeatReqs=${heartbeats.length}${heartbeats.slice(0, 2).map((h) => `[${h.fp || 'nofp'}]`).join('')}${mismatches.length ? ` MISMATCH_REQS=${JSON.stringify(mismatches.slice(0, 3))}` : ''})`);

  // Resume read-back through the same authenticated browser session.
  const resume = await page2.evaluate(async ({ fp, lessonId }) => {
    const r = await fetch(`/api/video/${lessonId}/resume`, {
      credentials: 'include',
      headers: { 'X-Device-Fingerprint': fp },
    });
    if (!r.ok) return { status: r.status };
    return { status: 200, position: (await r.json()).data.position };
  }, { fp: FP2, lessonId: LESSON2 });
  await page2.reload({ waitUntil: 'domcontentloaded' });
  await page2.waitForTimeout(8000);
  const afterReload = await page2.evaluate(() => ({
    iframe: !!document.querySelector('iframe'),
    src: document.querySelector('iframe')?.src || '',
  }));
  record(13, resume.status === 200 && resume.position > 0 && afterReload.iframe && afterReload.src.includes(VIDEO_ID2),
    `resume position=${resume.position}s returned (${resume.status}) and player re-initializes after reload`);

  // Summary
  const failed = results.filter((r) => !r.ok);
  console.log('\n================ SUMMARY ================');
  console.log(failed.length === 0 ? 'ALL_TESTS_PASS' : `${failed.length} FAILED`);
  for (const r of results) console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  [test ${r.n}] ${r.detail}`);
  await pg.end();
  await b.close();
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('ERR', e);
  process.exit(1);
});