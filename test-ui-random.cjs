const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
fs.mkdirSync('test-artifacts',{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});let failures=0;
 async function run(name,fn){const p=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];p.on('pageerror',e=>errors.push(e.message));try{await p.goto(process.env.TEST_URL||'http://localhost:8765');await p.waitForSelector('.move');assert.equal(await p.locator('#random-all').count(),1,'missing Losuj wszystkie button');assert.equal(await p.locator('#random-remaining').count(),1,'missing Losuj pozostałe button');await fn(p);assert.deepEqual(errors,[]);console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}finally{await p.close();}}
 const snapshot=p=>p.evaluate(()=>Array.from(document.querySelectorAll('.position input,.position select')).map(e=>[e.id,e.value,e.checked]));
 const dice=p=>p.locator('.die-value').evaluateAll(es=>es.map(e=>e.value));
 async function fixed(p,values){await p.evaluate(values=>{let i=0;Math.random=()=>values[i++%values.length];},values);}
 await run('all dice start new turn without losing table, bank or token',async p=>{
  await p.fill('#score-0','12');await p.fill('#bank','2');await p.selectOption('#roll','4');for(let i=0;i<5;i++)await p.check('#lock-'+i);
  await fixed(p,[0,.2,.4,.6,.99999]);await p.click('#random-all');assert.deepEqual(await dice(p),['1','2','3','4','6']);await expect(p.locator('#roll')).toHaveValue('1');assert.equal(await p.locator('.lock:checked').count(),0);await expect(p.locator('#extra')).not.toBeChecked();await expect(p.locator('#bank')).toHaveValue('2');await expect(p.locator('#score-0')).toHaveValue('12');await expect(p.locator('#used-0')).toBeChecked();await expect(p.locator('#freshness')).toHaveText('Nieaktualne');for(const b of await p.locator('.save-score').all())await expect(b).toBeDisabled();await p.waitForTimeout(200);await expect(p.locator('#freshness')).toHaveText('Nieaktualne');
 });
 await run('remaining preserves locks and increments; all locked and exhausted are blocked',async p=>{
  await p.check('#lock-0');await p.check('#lock-2');await fixed(p,[0,.5,.99999]);await p.click('#random-remaining');assert.deepEqual(await dice(p),['2','1','6','4','6']);await expect(p.locator('#roll')).toHaveValue('2');await expect(p.locator('#lock-0')).toBeChecked();await p.click('#random-remaining');await expect(p.locator('#roll')).toHaveValue('3');await p.uncheck('#extra');await expect(p.locator('#random-remaining')).toBeDisabled();await expect(p.locator('#random-help')).toContainText('3');await p.check('#extra');await expect(p.locator('#random-remaining')).toBeEnabled();for(let i=0;i<5;i++)await p.check('#lock-'+i);await expect(p.locator('#random-remaining')).toBeDisabled();await expect(p.locator('#random-help')).toContainText('odłożone');
 });
 await run('paid fourth: cancel atomic, accept exactly once, negative bank, token remains spent',async p=>{
  await p.fill('#score-0','12');await p.fill('#bank','2');await p.selectOption('#roll','3');await p.check('#lock-0');const before=await snapshot(p);let dialogs=0;
  p.once('dialog',async d=>{dialogs++;assert.match(d.message(),/10/);await d.dismiss();});await p.click('#random-remaining');assert.deepEqual(await snapshot(p),before);assert.equal(dialogs,1);
  await fixed(p,[0]);p.once('dialog',async d=>{dialogs++;await d.accept();});await p.click('#random-remaining');await expect(p.locator('#roll')).toHaveValue('4');await expect(p.locator('#bank')).toHaveValue('-8');await expect(p.locator('#score-0')).toHaveValue('12');await expect(p.locator('#extra')).not.toBeChecked();await expect(p.locator('#random-remaining')).toBeDisabled();assert.deepEqual(await dice(p),['2','1','1','1','1']);
  await p.locator('#random-remaining').evaluate(b=>{b.disabled=false;b.click();});await expect(p.locator('#bank')).toHaveValue('-8');assert.equal(dialogs,2);await p.click('#random-all');await expect(p.locator('#extra')).not.toBeChecked();await expect(p.locator('#bank')).toHaveValue('-8');await p.selectOption('#roll','3');await expect(p.locator('#random-remaining')).toBeDisabled();await p.fill('#score-0','18');await expect(p.locator('#bank')).toHaveValue('-2');
 });
 await run('invalid bank blocks purchase without changing position',async p=>{
  await p.selectOption('#roll','3');await p.fill('#bank','');await p.locator('#bank').pressSequentially('1e');const before=await snapshot(p);await p.click('#random-remaining');assert.deepEqual(await snapshot(p),before);await expect(p.locator('#random-help')).toContainText('bank');
 });
 await run('random edit discards pending results; desktop/mobile screenshots',async p=>{
  await p.route('**/solver-worker.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:'const send=self.postMessage.bind(self);self.postMessage=data=>setTimeout(()=>send(data),500);\n'+await response.text()});});await p.reload();await p.waitForSelector('.move');await p.click('#calculate');await p.click('#random-all');await expect(p.locator('#calculate')).toHaveAttribute('aria-busy','false');await expect(p.locator('#freshness')).toHaveText('Nieaktualne');for(const b of await p.locator('.save-score').all())await expect(b).toBeDisabled();
  for(const width of [1440,390,320]){await p.setViewportSize({width,height:width===1440?1100:844});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await expect(p.getByRole('button',{name:'Losuj wszystkie',exact:true})).toBeVisible();await expect(p.getByRole('button',{name:'Losuj pozostałe',exact:true})).toBeVisible();await p.screenshot({path:`test-artifacts/random-${width}.png`,fullPage:true});}
 });
 await browser.close();if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1)});
