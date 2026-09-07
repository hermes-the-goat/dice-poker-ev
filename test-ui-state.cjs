const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
fs.mkdirSync('test-artifacts',{recursive:true});
const url=process.env.TEST_URL||'http://localhost:8765';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 let failures=0;
 async function run(name,fn){const page=await browser.newPage({viewport:{width:1440,height:1100}});try{await fn(page);console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}finally{await page.close();}}
 async function ready(page){await page.goto(url);await page.waitForSelector('.move');}
 async function calculate(page){await page.click('#calculate');await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','false');}
 async function delayed(page){await page.route('**/solver-worker.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:'const send = self.postMessage.bind(self); self.postMessage = data => setTimeout(() => send(data), 500);\n'+await response.text()});});}
 for(const width of [1440,390])await run(`loader and stale result race ${width}`,async page=>{
  await page.setViewportSize({width,height:width===1440?1100:844});await delayed(page);await ready(page);
  await page.fill('#bank','10');await expect(page.locator('#freshness')).toHaveText('Nieaktualne');
  await page.click('#calculate');await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','true');await expect(page.locator('#calculate')).toBeDisabled();await expect(page.locator('#calculate .spinner')).toBeVisible();
  await page.screenshot({path:`test-artifacts/state-${width}-loading.png`,fullPage:true});
  await page.fill('#bank','50');await expect(page.locator('#freshness')).toHaveText('Nieaktualne');
  await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','false');await expect(page.locator('#freshness')).toHaveText('Nieaktualne');
  assert(!(await page.locator('#results').innerText()).includes('122,013'));
  await page.screenshot({path:`test-artifacts/state-${width}-stale.png`,fullPage:true});
  await calculate(page);await expect(page.locator('#freshness')).toHaveText('Aktualne');await expect(page.locator('.end-score b').first()).toContainText('162,013');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`test-artifacts/state-${width}-current.png`,fullPage:true});
 });
 await run('every input invalidates until explicit recalculation',async page=>{
  await ready(page);
  const changes=[...Array.from({length:5},(_,i)=>()=>page.fill('#die-'+i,'3')),...Array.from({length:5},(_,i)=>()=>page.check('#lock-'+i)),...Array.from({length:7},(_,i)=>()=>page.check('#used-'+i)),()=>page.selectOption('#roll','2'),()=>page.uncheck('#extra'),()=>page.fill('#bank','17'),()=>page.click('#reset')];
  for(const change of changes){await change();await expect(page.locator('#freshness')).toHaveText('Nieaktualne');await page.waitForTimeout(200);await expect(page.locator('#freshness')).toHaveText('Nieaktualne');await calculate(page);await expect(page.locator('#freshness')).toHaveText('Aktualne');}
 });
 await run('invalid dice recover without stuck loading',async page=>{
  await ready(page);await page.fill('#die-0','9');await calculate(page);await expect(page.locator('#status')).toContainText('Sprawdź');await expect(page.locator('#freshness')).toHaveText('Nieaktualne');assert.equal(await page.locator('.move').count(),0);await expect(page.locator('#calculate')).toBeEnabled();await page.fill('#die-0','2');await calculate(page);await expect(page.locator('#freshness')).toHaveText('Aktualne');
 });
 await run('reset during calculation discards old result and late validation errors',async page=>{
  await delayed(page);await ready(page);await page.fill('#die-0','9');await page.click('#calculate');await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','true');await page.click('#reset');await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','false');await expect(page.locator('#freshness')).toHaveText('Nieaktualne');assert(!(await page.locator('#status').innerText()).includes('Sprawdź'));await calculate(page);await expect(page.locator('#freshness')).toHaveText('Aktualne');
 });
 await run('model fetch failure exits busy state',async page=>{
  await page.route('**/values.json',route=>route.fulfill({status:503,body:'Unavailable'}));await page.goto(url);await expect(page.locator('#status')).toContainText('Nie udało');await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','false');await expect(page.locator('#calculate .spinner')).not.toBeVisible();
 });
 await run('worker crash exits busy state',async page=>{
  await page.route('**/solver-worker.js*',route=>route.fulfill({contentType:'text/javascript',body:'throw new Error("test crash")'}));await page.goto(url);await expect(page.locator('#status')).toContainText('Odśwież');await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','false');
 });
 await browser.close();if(failures)process.exitCode=1;
})();
