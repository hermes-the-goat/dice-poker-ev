'use strict';
const {chromium}=require('@playwright/test');
const fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const reports=[];
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});
  await page.goto(process.env.TEST_URL||'http://localhost:8765');
  await page.waitForFunction(()=>document.querySelector('#freshness').textContent==='Aktualne');
  const report=await page.evaluate(async()=>{
   const waitCurrent=()=>new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>{observer.disconnect();reject(Error('Ranking timeout'));},15000);
    const observer=new MutationObserver(()=>{if(document.querySelector('#freshness').textContent==='Aktualne'){clearTimeout(timeout);observer.disconnect();resolve();}});
    observer.observe(document.querySelector('#freshness'),{childList:true,subtree:true,characterData:true});
   });
   let promise=waitCurrent(),start=performance.now();document.querySelector('#mode-school').click();await promise;
   const firstModelAndRankMs=performance.now()-start,times=[];
   for(let i=0;i<40;i++){
    for(let c=0;c<13;c++){
     const used=c<12&&((i*37) & (1<<c))!==0;
     document.querySelector('#used-'+c).checked=used;
     document.querySelector('#score-'+c).value=c>=7&&used?'0':'';
    }
    for(let d=0;d<5;d++){document.querySelector('#die-'+d).value=String(1+(i+d*3)%6);document.querySelector('#lock-'+d).checked=i%4!==0&&d<i%3;}
    document.querySelector('#roll').value=String(1+i%3);
    document.querySelector('#extra').checked=i%2===0;
    document.querySelector('#roll').dispatchEvent(new Event('change',{bubbles:true}));
    promise=waitCurrent();start=performance.now();document.querySelector('#calculate').click();await promise;
    // Include a browser paint opportunity, not Playwright polling latency.
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
    times.push(performance.now()-start);
   }
   times.sort((a,b)=>a-b);
   return {firstModelAndRankMs,n:times.length,medianMs:times[Math.floor(times.length/2)],p95Ms:times[Math.floor(times.length*.95)],maxMs:times.at(-1)};
  });
  assert(report.maxMs<1000,`ranking exceeded 1 second: ${JSON.stringify(report)}`);
  reports.push({width,...report});await page.close();
 }
 fs.mkdirSync('test-artifacts',{recursive:true});fs.writeFileSync('test-artifacts/school-performance.json',JSON.stringify(reports,null,2));
 console.log('PASS real Chromium worker/UI ranking under 1s (desktop hardware; mobile viewport is not a physical phone):',JSON.stringify(reports));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
