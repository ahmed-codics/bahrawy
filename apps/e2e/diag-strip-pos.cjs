const { chromium } = require('playwright');
const API='http://localhost:3000', WEB='http://localhost:3001';
const FP=require('fs').readFileSync('/tmp/diag-creds.txt','utf8').split('\n')[1];
const PHONE=require('fs').readFileSync('/tmp/diag-creds.txt','utf8').split('\n')[0];
(async()=>{
  const b=await chromium.launch();
  // ultrawide-ish desktop viewport (letterbox potential in fullscreen)
  const ctx=await b.newContext({viewport:{width:1400,height:600}});
  const page=await ctx.newPage();
  const res=await ctx.request.post(`${API}/auth/login`,{data:{phone:PHONE,password:'diagpass123'},headers:{'x-device-fingerprint':FP}});
  const cookies=res.headers()['set-cookie'].split(/,(?=\w+=[^;]+;)/).map(p=>{const [nv,...a]=p.split(';');const [name,...v]=nv.split('=');return{name,value:v.join('='),domain:'localhost',path:'/',httpOnly:true}});
  await ctx.addCookies(cookies);
  await page.addInitScript(fp=>localStorage.setItem('bahrawy-device-fingerprint',fp),FP);
  await page.goto(`${WEB}/student/courses/afbb2884-19d6-40a8-8f7b-bb0174ab0589/lesson/3318de6c-e140-47a5-bf8e-5d37afdf4b8c`,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(7000);
  const r=await page.evaluate(()=>{
    const strip=document.querySelector('[aria-hidden="true"].absolute.inset-x-0');
    const stripRect=strip?strip.getBoundingClientRect():null;
    // find the video container (has iframe + strips)
    const videoContainer=strip?strip.parentElement:null;
    const vcRect=videoContainer?videoContainer.getBoundingClientRect():null;
    const stage=document.querySelector('[dir="ltr"]');
    const stageRect=stage?stage.getBoundingClientRect():null;
    const iframe=document.querySelector('iframe');
    const ir=iframe?iframe.getBoundingClientRect():null;
    const bottomAligns = stripRect && vcRect ? Math.abs((vcRect.bottom - stripRect.bottom)) < 2 : false;
    const iframeCoveredBottom = stripRect && ir ? (stripRect.top <= ir.bottom && stripRect.bottom >= ir.bottom-2) : false;
    // probe where YouTube bottom bar sits: at iframe bottom, left/center/right
    const probe=(x,y)=>{const el=document.elementFromPoint(x,y);let d=el?el.tagName:''; if(el&&typeof el.className==='string')d+=' '+String(el.className).slice(0,60); return d;};
    const ir2=ir;
    return {
      stage: stageRect?{y:Math.round(stageRect.y),bottom:Math.round(stageRect.bottom),h:Math.round(stageRect.height)}:null,
      videoContainer: vcRect?{y:Math.round(vcRect.y),bottom:Math.round(vcRect.bottom),h:Math.round(vcRect.height)}:null,
      strip: stripRect?{y:Math.round(stripRect.y),bottom:Math.round(stripRect.bottom),h:Math.round(stripRect.height)}:null,
      iframe: ir2?{y:Math.round(ir2.y),bottom:Math.round(ir2.bottom),h:Math.round(ir2.height)}:null,
      bottomAlignsWithVideo: bottomAligns,
      iframeBottomCovered: iframeCoveredBottom,
      hitBottomLeft: ir2?probe(ir2.x+40, ir2.bottom-30):null,
      hitBottomRight: ir2?probe(ir2.right-40, ir2.bottom-30):null,
      hitSeekCenter: ir2?probe(ir2.x+ir2.width*0.5, ir2.bottom-12):null,
    };
  });
  console.log(JSON.stringify(r,null,2));
  await b.close();
})().catch(e=>{console.error('ERR',e);process.exit(1)});
