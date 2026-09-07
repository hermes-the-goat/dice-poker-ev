const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict'),fs=require('node:fs');
const url=process.env.TEST_URL||'http://localhost:8765';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1100}});
 try{
 const requests=[];page.on('request',r=>requests.push(r.url()));
 await page.goto(url);await page.waitForSelector('.move');
 assert(!requests.some(u=>/school-(model|values|solver)/.test(u)),'Standard must not fetch school model');
 await expect(page.locator('#mode-school')).toBeVisible();
 await page.fill('#score-0','12');await page.fill('#die-0','5');await page.check('#lock-0');
 await page.click('#mode-school');await expect(page.locator('.category')).toHaveCount(13);
 await expect(page.locator('#turn-badge')).toHaveText('Tura 1 / 13');
 await expect(page.locator('#score-0')).toHaveValue('');await expect(page.locator('#die-0')).toHaveValue('2');
 await page.fill('#score-7','-3');await expect(page.locator('#score-total')).toHaveText('-3');
 await expect(page.locator('#school-bonus')).toContainText('-30');
 await page.fill('#score-8','1');await expect(page.locator('#score-8')).toHaveAttribute('aria-invalid','true');
 await page.fill('#score-8','0');await expect(page.locator('#used-8')).toBeChecked();
 await page.check('#used-9');await expect(page.locator('#score-9')).toHaveAttribute('aria-invalid','true');
 await page.fill('#score-9','0');await expect(page.locator('#score-error')).toBeEmpty();
 await page.click('#mode-standard');await page.waitForSelector('.move');
 await expect(page.locator('#score-0')).toHaveValue('12');await expect(page.locator('#die-0')).toHaveValue('5');await expect(page.locator('#lock-0')).toBeChecked();
 await page.click('#mode-school');await expect(page.locator('#score-7')).toHaveValue('-3');
 await page.click('#reset');
 for(let c=0;c<13;c++)await page.fill('#score-'+c,'0');
 await page.fill('#score-7','-1');await expect(page.locator('#score-total')).toHaveText('-31');
 await page.selectOption('#roll','4');await expect(page.locator('#score-total')).toHaveText('-41');
 await page.fill('#score-7','0');await page.fill('#score-12','12');await expect(page.locator('#score-total')).toHaveText('32');
 await expect(page.locator('#turn-badge')).toHaveText('Koniec gry');
 await page.uncheck('#used-0');await expect(page.locator('#score-total')).toHaveText('2');
 await expect(page.locator('#freshness')).toHaveText('Nieaktualne');
 fs.mkdirSync('test-artifacts',{recursive:true});
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:width===1440?1100:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`test-artifacts/school-${width}.png`,fullPage:true});}
 console.log('PASS school UI: independent state, signed/required/reachable SN, terminal bonus once, paid roll, responsive screenshots');
 const available=await page.evaluate(async()=>{try{return (await fetch('school-model.json')).ok&&(await fetch('school-values.bin')).ok}catch{return false}});
 if(!available){console.log('BLOCKED real school EV integration: school-model.json / school-values.bin not ready (no substitute EV)');return;}
 await page.click('#mode-standard');await page.click('#reset');await page.click('#calculate');await expect(page.locator('#freshness')).toHaveText('Aktualne');
 const standard=await page.locator('.ev-number').allTextContents();
 await page.click('#mode-school');await page.click('#reset');for(let c=7;c<13;c++)await page.fill('#score-'+c,'0');
 await expect(page.locator('#calculate')).toBeEnabled({timeout:30000});await page.click('#calculate');await expect(page.locator('#freshness')).toHaveText('Aktualne',{timeout:30000});
 assert.deepEqual(await page.locator('.ev-number').allTextContents(),standard,'all SN=0, seven Standard free must match Standard');
 for(const width of [1440,390]){await page.setViewportSize({width,height:width===1440?1100:844});await page.screenshot({path:`test-artifacts/school-${width}-current.png`,fullPage:true});}
 // One remaining school field: real negative score is recordable, never voluntary zero.
 for(let c=0;c<13;c++)await page.fill('#score-'+c,'0');await page.uncheck('#used-12');
 for(let i=0;i<5;i++)await page.fill('#die-'+i,'1');await page.selectOption('#roll','3');await page.uncheck('#extra');
 await page.click('#calculate');await expect(page.locator('#freshness')).toHaveText('Aktualne');
 await expect(page.locator('.move h3').first()).toContainText('-18 pkt');assert(!(await page.locator('#results').innerText()).includes('Skreśl: S'));
 await page.locator('.save-score').first().click();await expect(page.locator('#score-12')).toHaveValue('-18');await expect(page.locator('#score-total')).toHaveText('-58');
 // Natural zero is a score action, not a voluntary scratch.
 await page.uncheck('#used-12');for(const [i,v] of [6,6,6,1,1].entries())await page.fill('#die-'+i,String(v));
 await page.click('#calculate');await expect(page.locator('#freshness')).toHaveText('Aktualne');await expect(page.locator('.move h3').first()).toContainText('Zapisz: S6 · 0 pkt');await page.locator('.save-score').first().click();await expect(page.locator('#score-12')).toHaveValue('0');
 // No double-counted provisional bonus while Standard fields remain.
 await page.uncheck('#used-0');await page.fill('#score-12','12');await page.click('#calculate');await expect(page.locator('#freshness')).toHaveText('Aktualne');
 const ev=Number((await page.locator('.ev-number').first().innerText()).replace(/\s|pkt/g,'').replace(',','.'));await expect(page.locator('.end-score b').first()).toHaveText((2+ev).toLocaleString('pl-PL',{minimumFractionDigits:3,maximumFractionDigits:3})+' pkt');
 console.log('PASS real school EV, Standard equivalence, negative/natural-zero save, bonus not double counted');
 // Delay only delivery of real solver responses; never replace EV.
 await page.route('**/solver-worker.js*',async route=>{const response=await route.fetch();await route.fulfill({response,body:'const send=self.postMessage.bind(self);self.postMessage=data=>setTimeout(()=>send(data),400);\n'+await response.text()});});
 await page.click('#mode-standard');await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','true');await page.click('#mode-school');await expect(page.locator('#freshness')).toHaveText('Aktualne',{timeout:30000});await expect(page.locator('.category')).toHaveCount(13);
 await page.fill('#score-12','6');await page.click('#calculate');await page.click('#mode-standard');await expect(page.locator('#freshness')).toHaveText('Aktualne');await expect(page.locator('.category')).toHaveCount(7);await expect(page.locator('#score-total')).toHaveText('0');
 await page.route('**/school-model.json',route=>route.fulfill({status:503,body:'Unavailable'}));await page.click('#mode-school');await expect(page.locator('#status')).toContainText('Nie udało');await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','false');await expect(page.locator('.move')).toHaveCount(0);
 await page.click('#mode-standard');await expect(page.locator('#freshness')).toHaveText('Aktualne');
 console.log('PASS switch during model/calculation, school fetch error exits loader, Standard recovers');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
