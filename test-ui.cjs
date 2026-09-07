const {chromium,expect}=require('@playwright/test');const assert=require('node:assert/strict');
async function calculate(page){await page.click('#calculate');await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','false');}
require('node:fs').mkdirSync('test-artifacts',{recursive:true});
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.TEST_URL||'http://localhost:8765');await page.waitForSelector('.move');
assert((await page.locator('.move h3').first().innerText()).includes('Dwie pary'));
assert.equal(await page.locator('.move').count(),4);
await page.screenshot({path:'test-artifacts/site-desktop.png',fullPage:true});
// Reproduce preserving a pair by crossing out poker on the final normal throw.
await page.selectOption('#roll','3');await page.uncheck('#extra');
for(let c=1;c<=5;c++)await page.check('#used-'+c);
for(const [i,v] of [1,1,3,4,6].entries())await page.fill('#die-'+i,String(v));
await calculate(page);assert((await page.locator('.move h3').first().innerText()).includes('Skreśl: Poker'));
// Four locked sixes, only poker remains: buy final die roll.
await page.check('#used-0');for(const [i,v] of [6,6,6,6,2].entries())await page.fill('#die-'+i,String(v));
for(let i=0;i<4;i++)await page.check('#lock-'+i);await page.check('#extra');await calculate(page);
assert((await page.locator('.move p').first().innerText()).includes('Kup czwarty rzut'));
assert((await page.locator('.move h3').first().innerText()).includes('6 · 6 · 6 · 6'));
await page.selectOption('#roll','4');assert(await page.locator('#extra').isDisabled());assert(!(await page.locator('#extra').isChecked()));
await calculate(page);assert(!(await page.locator('#results').innerText()).includes('Kup czwarty'));
await page.check('#used-6');await calculate(page);assert.equal(await page.locator('.move').count(),0);
await page.click('#reset');await page.fill('#die-0','9');await calculate(page);assert.equal(await page.locator('.move').count(),0);assert((await page.locator('#status').innerText()).includes('Sprawdź'));
await page.click('#reset');await page.fill('#score-0','50');await calculate(page);const ev=Number((await page.locator('.ev-number').first().innerText()).replace(/\s|pkt/g,'').replace(',','.'));assert.equal(await page.locator('.end-score b').first().innerText(),(50+ev).toLocaleString('pl-PL',{minimumFractionDigits:3,maximumFractionDigits:3})+' pkt');
await page.click('#reset');await calculate(page);await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-artifacts/site-mobile.png',fullPage:true});
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await page.setViewportSize({width:320,height:740});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.deepEqual(errors,[]);await browser.close();console.log('PASS desktop/mobile, ranking, locks, voluntary zero, fourth roll, completed game, invalid dice, total EV, no JS errors.');})().catch(e=>{console.error(e);process.exit(1)});
