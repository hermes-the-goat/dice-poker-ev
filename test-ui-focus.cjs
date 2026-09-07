const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const url=process.env.TEST_URL||'http://localhost:8765';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 let failures=0;
 for(const mobile of [false,true]){
  async function run(name,fn){
   const page=await browser.newPage({viewport:{width:mobile?390:1440,height:mobile?844:1100},isMobile:mobile,hasTouch:mobile});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{await page.goto(url);await page.waitForSelector('.move');await fn(page);assert.deepEqual(errors,[]);console.log('PASS',mobile?'mobile':'desktop',name);}
   catch(e){failures++;console.error('FAIL',mobile?'mobile':'desktop',name,e.message);}
   finally{await page.close();}
  }
  await run('valid digit focuses next die and selects its entire old value',async page=>{
   await page.fill('#die-0','6');
   await expect(page.locator('#die-1')).toBeFocused();
   assert.deepEqual(await page.locator('#die-1').evaluate(el=>[el.selectionStart,el.selectionEnd]),[0,1]);
   await page.keyboard.insertText('3');
   await expect(page.locator('#die-1')).toHaveValue('3');
   await expect(page.locator('#die-2')).toBeFocused();
  });
  await run('five rapid digits replace old values without wrapping or recalculating',async page=>{
   // Save controls must become stale; the ranking itself must not recalculate.
   const ranking=()=>page.locator('#results').evaluate(el=>{const copy=el.cloneNode(true);copy.querySelectorAll('.save-score,.save-hint').forEach(n=>n.remove());return copy.innerHTML;});
   const oldResults=await ranking();
   // Record actual calculation messages, but keep the real worker and solver.
   await page.evaluate(()=>{window.calculations=0;const send=Worker.prototype.postMessage;Worker.prototype.postMessage=function(...args){window.calculations++;return send.apply(this,args);};});
   await page.fill('#die-0','');
   if(mobile){
    // Soft keyboards deliver input without necessarily delivering keydown.
    for(const digit of '12345')await page.keyboard.insertText(digit);
   }else await page.keyboard.type('12345',{delay:0});
   assert.deepEqual(await page.locator('.die-value').evaluateAll(els=>els.map(el=>el.value)),['1','2','3','4','5']);
   await expect(page.locator('#die-4')).toBeFocused();
   await expect(page.locator('#freshness')).toHaveText('Nieaktualne');
   assert.equal(await ranking(),oldResults);
   for(const button of await page.locator('.save-score').all())await expect(button).toBeDisabled();
   assert.equal(await page.evaluate(()=>window.calculations),0);
   await page.click('#calculate');
   await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','false');
   await expect(page.locator('#freshness')).toHaveText('Aktualne');
   assert.equal(await page.evaluate(()=>window.calculations),1);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  });
  await run('empty, invalid and multiple-digit values do not advance',async page=>{
   for(const value of ['','0','7','12','-1','1.5']){
    await page.fill('#die-0',value);
    await expect(page.locator('#die-0')).toBeFocused();
    await expect(page.locator('#freshness')).toHaveText('Nieaktualne');
   }
   await page.click('#calculate');
   await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','false');
   await expect(page.locator('#status')).toContainText('Sprawdź');
  });
  await run('selection covers a multi-character next value; numeric keyboard hint remains',async page=>{
   await page.fill('#die-1','12');await page.fill('#die-0','4');
   await expect(page.locator('#die-1')).toBeFocused();
   assert.deepEqual(await page.locator('#die-1').evaluate(el=>[el.selectionStart,el.selectionEnd]),[0,2]);
   await page.keyboard.insertText('2');await expect(page.locator('#die-1')).toHaveValue('2');
   for(let i=0;i<5;i++)await expect(page.locator('#die-'+i)).toHaveAttribute('inputmode','numeric');
  });
 }
 await browser.close();if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
