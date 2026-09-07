const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
fs.mkdirSync('test-artifacts',{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});let failures=0;
 async function run(name,fn){const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));try{await page.goto(process.env.TEST_URL||'http://localhost:8765');await page.waitForSelector('.move');await fn(page);assert.deepEqual(errors,[]);console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}finally{await page.close();}}
 async function calc(p){await p.click('#calculate');await expect(p.locator('#calculate')).toHaveAttribute('aria-busy','false');}
 const total=(p,n)=>expect(p.locator('#score-total')).toHaveText(String(n));
 async function forecast(p){for(const card of await p.locator('.move').all()){const values=await card.locator('.ev-number,.end-score b').allTextContents();const number=s=>Number(s.replace(/\s|pkt/g,'').replace(',','.'));assert(Math.abs(number(values[1])-number(values[0])-Number(await p.locator('#score-total').textContent()))<.002);}}
 await run('read-only net total above table; removed obsolete copy',async p=>{
  assert.equal(await p.locator('#bank').count(),0,'manual bank must be removed');assert.equal(await p.locator('#paid-note,#random-all-help').count(),0);
  assert(await p.locator('#score-total').evaluate(e=>!!(e.compareDocumentPosition(document.querySelector('.categories-field'))&Node.DOCUMENT_POSITION_FOLLOWING)));
  await total(p,0);await p.selectOption('#roll','3');assert(!(await p.locator('.position').innerText()).includes('Czwarty rzut wymaga potwierdzenia:'));
 });
 await run('optional scores, zero, availability, edits, clearing and reset',async p=>{
  assert.equal(await p.locator('.category-score').count(),7);await p.check('#used-2');await total(p,0);
  await p.fill('#score-0','12');await expect(p.locator('#used-0')).toBeChecked();await total(p,12);
  await p.uncheck('#extra');await total(p,2);await p.check('#extra');await total(p,12);await p.uncheck('#extra');await total(p,2);
  await p.fill('#score-0','18');await total(p,8);await p.fill('#score-1','0');await expect(p.locator('#used-1')).toBeChecked();
  await p.uncheck('#used-0');await expect(p.locator('#score-0')).toHaveValue('');await total(p,-10);
  await p.fill('#score-3','20');await p.fill('#score-3','');await expect(p.locator('#used-3')).toBeChecked();await total(p,-10);
  await p.click('#reset');await total(p,0);await expect(p.locator('#extra')).toBeChecked();assert.equal(await p.locator('.category input:checked').count(),0);
 });
 await run('save actual score once, not EV, and retain dice/roll',async p=>{
  await p.uncheck('#extra');await calc(p);const first=p.locator('.move').first();await expect(first.locator('.save-score')).toBeEnabled();await first.locator('.save-score').click();
  await expect(p.locator('#score-1')).toHaveValue('32');await total(p,22);await expect(p.locator('#used-1')).toBeChecked();await expect(p.locator('#roll')).toHaveValue('1');await expect(p.locator('#die-0')).toHaveValue('2');
  await p.locator('.save-score').first().evaluate(b=>{b.disabled=false;b.click();});await total(p,22);await calc(p);assert(!(await p.locator('.move h3').allTextContents()).some(t=>t.includes('Dwie pary')));await forecast(p);
 });
 await run('zero action records literal zero and hold explains disabled button',async p=>{
  await p.selectOption('#roll','3');await p.uncheck('#extra');for(let c=1;c<=5;c++)await p.check('#used-'+c);for(const [i,v] of [1,1,3,4,6].entries())await p.fill('#die-'+i,String(v));await calc(p);
  await p.locator('.save-score').first().click();await expect(p.locator('#score-6')).toHaveValue('0');await expect(p.locator('#used-6')).toBeChecked();await total(p,-10);
  await p.click('#reset');await p.selectOption('#roll','3');for(let c=0;c<6;c++)await p.check('#used-'+c);for(const [i,v] of [6,6,6,6,2].entries())await p.fill('#die-'+i,String(v));for(let i=0;i<4;i++)await p.check('#lock-'+i);await calc(p);
  const first=p.locator('.move').first();await expect(first.locator('.save-score')).toBeDisabled();await expect(first).toContainText('Najpierw wykonaj rzut');await forecast(p);
 });
 await run('every edit disables stale save buttons',async p=>{
  const changes=[()=>p.fill('#score-0','8'),()=>p.fill('#die-0','3'),()=>p.check('#lock-0'),()=>p.check('#used-2'),()=>p.selectOption('#roll','2'),()=>p.uncheck('#extra'),()=>p.click('#reset')];
  for(const change of changes){await change();for(const b of await p.locator('.save-score').all())await expect(b).toBeDisabled();await calc(p);}
  await p.check('#used-1');await p.locator('.save-score').first().evaluate(b=>{b.disabled=false;b.click();});await expect(p.locator('#score-1')).toHaveValue('');
 });
 await run('score edit during delayed solver cannot restore stale save buttons',async p=>{
  await p.route('**/solver-worker.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:'const send=self.postMessage.bind(self);self.postMessage=data=>setTimeout(()=>send(data),500);\n'+await response.text()});});
  await p.reload();await p.waitForSelector('.move');await p.uncheck('#extra');await p.click('#calculate');await expect(p.locator('#calculate')).toHaveAttribute('aria-busy','true');await p.fill('#score-1','7');await expect(p.locator('#calculate')).toHaveAttribute('aria-busy','false');await expect(p.locator('#freshness')).toHaveText('Nieaktualne');
  for(const b of await p.locator('.save-score').all())await expect(b).toBeDisabled();await p.locator('.save-score').first().evaluate(b=>{b.disabled=false;b.click();});await expect(p.locator('#score-1')).toHaveValue('7');await total(p,-3);await calc(p);await expect(p.locator('#freshness')).toHaveText('Aktualne');await forecast(p);
 });
 await run('invalid scores never corrupt total and can recover',async p=>{
  await p.fill('#score-0','12');for(const bad of ['-1','1.5','1e100']){await p.fill('#score-0',bad);await calc(p);await expect(p.locator('#score-error')).not.toBeEmpty();await total(p,12);assert(!(await p.locator('.position').innerText()).includes('NaN'));}
  await p.fill('#score-0','16');await total(p,16);await calc(p);await expect(p.locator('#freshness')).toHaveText('Aktualne');
 });
 await run('manual fourth roll derives one cost; final EV and responsive screenshots',async p=>{
  await p.selectOption('#roll','4');await total(p,-10);for(const c of [0,2,3,4,5])await p.check('#used-'+c);await calc(p);await forecast(p);await p.locator('.save-score').first().click();await expect(p.locator('#score-1')).toHaveValue('16');await total(p,6);await p.fill('#score-1','18');await total(p,8);await calc(p);await forecast(p);
  for(const width of [1440,390,320]){await p.setViewportSize({width,height:width===1440?1100:844});await p.evaluate(()=>document.fonts.ready);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const totalBox=await p.locator('.score-summary').boundingBox(),tableBox=await p.locator('.categories-field').boundingBox();assert(totalBox.y+totalBox.height<=tableBox.y);await p.screenshot({path:`test-artifacts/net-score-${width}.png`,fullPage:true});}
  await p.selectOption('#roll','1');await total(p,8);await p.check('#used-6');await calc(p);await expect(p.locator('#status')).toContainText('wynik: 8 pkt');
 });
 await browser.close();if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
