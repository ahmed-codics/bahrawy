const { chromium } = require('playwright');
const API='http://localhost:3000', STAFF='http://localhost:3002', WEB='http://localhost:3001';
const LESSON='3318de6c-e140-47a5-bf8e-5d37afdf4b8c';
const COURSE='afbb2884-19d6-40a8-8f7b-bb0174ab0589';
const FP='diag-fresh-device-003';
const stamp=Date.now();
const phone=`010${Math.floor(10000000+Math.random()*90000000)}`;
const login=async(ctx,path,body,fp)=>{
  const r=await ctx.request.post(`${API}${path}`,{data:body,headers:fp?{'x-device-fingerprint':fp}:undefined});
  const c=r.headers()['set-cookie'];
  const cr=await ctx.request.get(`${API}/auth/csrf-token`,{headers:{cookie:c}});
  return {cookies:c,csrf:(await cr.json()).csrfToken};
};
(async()=>{
  const b=await chromium.launch();
  const ctx=await b.newContext({viewport:{width:1400,height:700}});
  const staff=await login(ctx,'/auth/staff-login',{email:'admin@bahrawy.test',password:'owner_secret'});
  const reg=await ctx.request.post(`${API}/auth/register`,{data:{firstName:'Diag',secondName:'Fresh',thirdName:'Strip',lastName:`Chk${stamp}`,phone,parentPhone:`011${Math.floor(10000000+Math.random()*90000000)}`,email:`diagfresh${stamp}@bahrawy.test`,schoolName:'Test School',gender:'MALE',city:'Cairo',gradeId:'6ba0f5e8-120e-4492-a135-0696839bb80a',password:'student_secret'}});
  if(!reg.ok()){console.log('REGISTER FAIL',reg.status());process.exit(1);}
  const stu=await login(ctx,'/auth/login',{phone,password:'student_secret'},FP);
  const create=await ctx.request.post(`${API}/video-access-requests`,{data:{lessonId:LESSON},headers:{cookie:stu.cookies,'x-device-fingerprint':FP,'x-csrf-token':stu.csrf}});
  const ctxt=await create.text(); console.log('CREATE:',create.status(),ctxt.slice(0,250)); const created=(await create.json()).data; console.log('CREATED:',JSON.stringify(created).slice(0,200));
  console.log('CREATED_ID:',created?.id); const approve=await ctx.request.post(`${API}/admin/v1/video-access/requests/${created.id}/approve`,{data:{durationType:'ONE_DAY'},headers:{cookie:staff.cookies,'x-csrf-token':staff.csrf}});
  console.log('APPROVE:',approve.status(),(await approve.json()).data?.grantId||'');
  await ctx.addCookies(stu.cookies.split(/,(?=\w+=[^;]+;)/).map(p=>{const [nv,...a]=p.split(';');const [name,...v]=nv.split('=');return{name,value:v.join('='),domain:'localhost',path:'/',httpOnly:true}}));
  const page=await ctx.newPage();
  await page.addInitScript(fp=>localStorage.setItem('bahrawy-device-fingerprint',fp),FP);
  await page.goto(`${WEB}/student/courses/${COURSE}/lesson/${LESSON}`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(9000);
  const r=await page.evaluate(()=>{
    const iframe=document.querySelector('iframe');
    if(!iframe) return {error:'no iframe',body:document.body.innerText.replace(/\n/g,' ').slice(0,160)};
    const ir=iframe.getBoundingClientRect();
    const strips=[...document.querySelectorAll('[aria-hidden="true"].absolute.inset-x-0')].map(s=>{const rc=s.getBoundingClientRect();return{style:s.getAttribute('style'),top:Math.round(rc.top),bottom:Math.round(rc.bottom),h:Math.round(rc.height)}});
    const probe=(x,y)=>{const el=document.elementFromPoint(x,y);return el?(el.tagName+' '+String(el.className).slice(0,45)):null;};
    return {
      iframe:{top:Math.round(ir.top),bottom:Math.round(ir.bottom),h:Math.round(ir.height)},
      strips,
      hitBottomLeft:probe(ir.left+40,ir.bottom-30),
      hitSeekCenter:probe(ir.left+ir.width*0.5,ir.bottom-12),
      hitTopTitle:probe(ir.left+ir.width*0.5,ir.top+20),
      hitMidBody:probe(ir.left+ir.width*0.5,ir.top+ir.height*0.5),
    };
  });
  console.log('RESULT:',JSON.stringify(r,null,2));
  await b.close();
})().catch(e=>{console.error('ERR',e);process.exit(1)});
