'use strict';
const {chromium,expect}=require('@playwright/test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const url=process.env.TEST_URL||'http://localhost:8765';
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext();
 const page=await context.newPage();
 try{
  // Leave metadata untouched and change one finite, nonterminal Float64 only.
  // standard mask=1, school mask=0, sumSN=0: outside terminal bonus checks.
  const metadataResponse=await context.request.get(url+'/school-model.json');
  assert(metadataResponse.ok());
  const metadata=await metadataResponse.json();
  assert.match(metadata.sha256,/^[a-f0-9]{64}$/);
  let intercepted=0;
  await context.route('**/school-values.bin',async route=>{
   const response=await route.fetch();
   assert(response.ok());
   const original=await response.body();
   assert.equal(createHash('sha256').update(original).digest('hex'),metadata.sha256);
   const corrupted=Buffer.from(original);
   const index=(metadata.sumStride+metadata.sumOffsets[0]+metadata.sumsByRemaining[0].indexOf(0))*2;
   const value=corrupted.readDoubleLE(index*8);
   assert(Number.isFinite(value));
   corrupted.writeDoubleLE(value+1,index*8);
   assert(Number.isFinite(corrupted.readDoubleLE(index*8)));
   assert.notEqual(corrupted.readDoubleLE(index*8),value);
   assert.equal(corrupted.length,metadata.byteLength);
   assert.notEqual(createHash('sha256').update(corrupted).digest('hex'),metadata.sha256);
   intercepted++;
   await route.fulfill({response,body:corrupted});
  });
  await page.goto(url);await page.waitForSelector('.move');
  await page.click('#mode-school');
  await expect(page.locator('#status')).toContainText('Nie udało',{timeout:15000});
  assert.equal(intercepted,1,'The real worker must fetch the corrupted LUT');
  await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','false');
  await expect(page.locator('.move')).toHaveCount(0);
  await expect(page.locator('#freshness')).not.toHaveText('Aktualne');
  await page.click('#mode-standard');
  await expect(page.locator('#freshness')).toHaveText('Aktualne',{timeout:15000});
  await context.unroute('**/school-values.bin');
  await page.click('#mode-school');
  await expect(page.locator('#freshness')).toHaveText('Aktualne',{timeout:30000});
  assert(await page.locator('.move').count()>0,'The unmodified real model must produce results');
  await expect(page.locator('#calculate')).toHaveAttribute('aria-busy','false');
  console.log('PASS LUT integrity: finite nonterminal corruption rejected, loader exits, Standard recovers, real school model passes');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
