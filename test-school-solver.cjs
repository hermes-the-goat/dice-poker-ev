'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {performance}=require('node:perf_hooks');
const solverPath=path.join(__dirname,'school-solver.js');
assert.ok(fs.existsSync(solverPath),'RED: school-solver.js must implement the new engine');
const {Engine,points,names}=require(solverPath);
const Standard=require('./solver.js');
const standardValues=require('./values.json');
const bonus=s=>s<0?-30:s>10?30:0;
const near=(a,b,msg='EV')=>assert.ok(Math.abs(a-b)<1e-8,`${msg}: ${a} != ${b}`);
function metadata(){
 let offset=0;
 const sumsByRemaining=Array.from({length:64},(_,h)=>{
  let sums=new Set([0]);
  for(let n=1;n<=6;n++)if(!(h&(1<<(n-1))))sums=new Set([...sums].flatMap(s=>Array.from({length:7},(_,k)=>s+(k-3)*n)));
  return [...sums].sort((a,b)=>a-b);
 });
 const sumOffsets=sumsByRemaining.map(s=>{const o=offset;offset+=s.length;return o;});
 assert.equal(offset,3752);
 return {version:1,layout:'standard-school-sum-extra',sumOffsets,sumsByRemaining,sumStride:offset};
}
const meta=metadata();
// EXPLICIT SYNTHETIC fixture: only H=0 has real standard continuation values.
// Other slices are deliberately non-optimal, for indexing/mechanics checks only.
const synthetic=new Float64Array(128*3752*2);
for(let a=0;a<128;a++)for(let h=0;h<64;h++)meta.sumsByRemaining[h].forEach((s,i)=>{
 for(let e=0;e<2;e++)synthetic[((a*3752+meta.sumOffsets[h]+i)*2)+e]=standardValues[a][e]+bonus(s);
});
assert.throws(()=>new Engine({},synthetic),/model|metadata|format|wersj/i);
assert.throws(()=>new Engine(meta,new Float64Array(1)),/model|length|rozmiar/i);
assert.throws(()=>new Engine(meta,new Float64Array(synthetic.length)),/model|bonus|korekt/i);
for(const bad of [{slotCount:1},{byteLength:1},{endianness:'big'},{rulesVersion:'wrong'}])assert.throws(()=>new Engine({...meta,...bad},synthetic),/model|format|wersj/i);
const nonfinite=synthetic.slice();nonfinite[nonfinite.length-1]=NaN;
assert.throws(()=>new Engine(meta,nonfinite),/model/i);
const invalid=structuredClone(meta);invalid.sumsByRemaining[63]=[1];
assert.throws(()=>new Engine(invalid,synthetic),/model|sum/i);
const engine=new Engine(meta,synthetic);
assert.equal(names.length,13);
for(let n=1;n<=6;n++)for(let m=0;m<=5;m++)for(const first of [false,true]){
 const counts=[0,0,0,0,0,0];counts[n-1]=m;counts[n%6]=5-m;
 assert.equal(points(counts,n+6,first),n*(m-3)+(first&&m>=3?n:0));
 for(let c=0;c<7;c++)assert.equal(points(counts,c,first),Standard.points(counts,c,first));
}
const base={dice:[1,1,1,2,3],locked:[true,false,false,false,false],mask:128,roll:1,extra:true,sumSN:0};
assert.throws(()=>engine.rank({...base,mask:8191,sumSN:1}),/sum/i);
assert.throws(()=>engine.value(8191,true,1),/sum/i);
assert.throws(()=>engine.rank({...base,sumSN:0.5}),/sum/i);
assert.throws(()=>engine.rank({...base,roll:4}),/rzut|roll/i);
for(const s of [-1,0,10,11])near(engine.value(0,true,s),bonus(s));
for(const roll of [1,2,3,4]){
 const state={...base,roll,extra:roll!==4};const ranked=engine.rank(state);
 assert.ok(!ranked.some(a=>a.type==='zero'));
 const score=ranked.find(a=>a.type==='score');
 assert.equal(score.points,roll===1?1:0);
 near(score.ev,score.points+bonus(score.points));
 for(const a of ranked.filter(a=>a.type==='hold')){
  assert.ok(a.held[0]>=1);assert.equal(a.cost,roll===3?10:0);
 }
 assert.equal(ranked.some(a=>a.type==='hold'),roll<4);
}
const negative=engine.rank({...base,dice:[6,6,6,6,6],roll:4,extra:false})[0];
assert.equal(negative.points,-3);near(negative.ev,-33);
const locked=engine.rank({...base,locked:Array(5).fill(true)});
assert.equal(locked.length,1);
// Independent ordered-dice enumeration of the last purchased reroll, with terminal bonus.
const third={...base,roll:3,dice:[1,2,3,4,5],sumSN:10};
const purchase=engine.rank(third).find(a=>a.type==='hold'&&a.held.join(',')==='1,0,0,0,0,0');
let brute=0;
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)for(let d=1;d<=6;d++){
 const q=1+[a,b,c,d].filter(x=>x===1).length-3;brute+=q+bonus(10+q);
}
near(purchase.ev,brute/6**4-10,'independent purchased reroll');
function regression(e,label){
 const std=new Standard.Engine(standardValues);let boundaries=0,ranks=0;
 for(let a=0;a<128;a++)for(const extra of [false,true])for(const s of [-1,0,10,11]){
  near(e.value(a,extra,s),standardValues[a][+extra]+bonus(s),`${label} boundary`);boundaries++;
 }
 for(const mask of [1,3,8,42,64,127])for(const roll of [1,2,3,4])for(const extra of [false,true]){
  if(roll===4&&extra)continue;
  for(const dice of [[1,2,3,4,5],[6,6,6,6,6],[2,2,3,3,4]])for(const locked of [Array(5).fill(false),[true,false,true,false,false],Array(5).fill(true)]){
   const state={dice,locked,mask,roll,extra};const expected=std.rank(state);
   for(const sumSN of [-1,0,11]){
    const got=e.rank({...state,sumSN});assert.equal(got.length,expected.length);
    const byId=new Map(got.map(a=>[a.id,a]));
    for(const action of expected){const actual=byId.get(action.id);assert.ok(actual);near(actual.ev,action.ev+bonus(sumSN),label+' rank');assert.deepEqual({...actual,ev:0},{...action,ev:0});}
    ranks++;
   }
  }
 }
 console.log(`${label}: ${boundaries} boundary checks; ${ranks} rank comparisons`);
}
regression(engine,'SYNTHETIC mechanics/H0 slices');
// Cache must distinguish both mask and sum and evict least recently used entries.
engine.cache.clear();engine.solve(128,0);engine.solve(128,1);engine.solve(256,0);
assert.equal(engine.cache.size,3);
for(let s=-20;s<=20;s++)engine.solve(128,s);
assert.ok(engine.cache.size<=16,'bounded LRU cache');
engine.cache.clear();for(let s=0;s<16;s++)engine.solve(128,s);
const cached=engine.solve(128,0);engine.solve(128,16);
assert.ok(engine.cache.has('128:0'));assert.ok(!engine.cache.has('128:1'));
assert.equal(engine.solve(128,0),cached,'LRU hit reuses computed DP');
const vm=require('node:vm');const sandbox={};vm.runInNewContext(fs.readFileSync(solverPath,'utf8'),sandbox);assert.equal(typeof sandbox.DicePokerSchool.Engine,'function');assert.equal(sandbox.DicePokerSchool.names.length,13);
console.log('PASS: synthetic scoring, validation, permanent locks, purchased roll, cache, browser export');
const mp=path.join(__dirname,'school-model.json'),bp=path.join(__dirname,'school-values.bin');
if(!fs.existsSync(mp)||!fs.existsSync(bp)){
 console.log('SKIP REAL MODEL: school-model.json / school-values.bin absent; synthetic tests are NOT full-game validation.');
 if(process.argv.includes('--require-model'))process.exitCode=1;
}else{
 const m=JSON.parse(fs.readFileSync(mp,'utf8'));const bytes=fs.readFileSync(bp);assert.equal(bytes.byteLength,128*3752*2*8);
 const values=new Float64Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const t=performance.now();const real=new Engine(m,values);console.log(`REAL construction: ${(performance.now()-t).toFixed(2)} ms`);
 regression(real,'REAL MODEL');
 // Independent single-school oracle: collapse all non-N faces to failures,
 // enumerate *legal* match/nonmatch holds, use binomial outcomes and terminal B.
 // No geometry, points(), solve(), or LUT continuation is reused by this oracle.
 let oracleRanks=0,oracleBoundaries=0;
 const fact=[1,1,2,6,24,120];
 const probability=(n,k)=>fact[n]/fact[k]/fact[n-k]*(1/6)**k*(5/6)**(n-k);
 for(const n of [1,3,6])for(const s of [-11,-1,0,1,9,10,11,20]){
  const mask=1<<(n+6);if(!m.sumsByRemaining[mask>>7].includes(s))continue;
  const memo=new Map();
  const stop=(matches,r)=>{const q=n*(matches-3)+(r===1&&matches>=3?n:0);return q+bonus(s+q);};
  function holdEV(hm,ho,r,e){
   const remaining=5-hm-ho;let ev=0;
   for(let k=0;k<=remaining;k++)ev+=probability(remaining,k)*best(hm+k,hm,ho,r+1,r===3?false:e);
   return ev-(r===3?10:0);
  }
  function best(matches,lm,lo,r,e){
   const k=[matches,lm,lo,r,e].join(',');if(memo.has(k))return memo.get(k);
   let v=stop(matches,r);
   if(r<3||(r===3&&e))for(let hm=lm;hm<=matches;hm++)for(let ho=lo;ho<=5-matches;ho++)if(hm+ho<5)v=Math.max(v,holdEV(hm,ho,r,e));
   memo.set(k,v);return v;
  }
  for(const extra of [false,true]){
   let ev=0;for(let count=0;count<=5;count++)ev+=probability(5,count)*best(count,0,0,1,extra);
   near(real.value(mask,extra,s),ev,'REAL independent school boundary');oracleBoundaries++;
   for(const roll of [1,2,3,4]){
    if(roll===4&&extra)continue;
    const dice=[n,n,n%6+1,n%6+1,n%6+1],locked=[true,false,true,false,false];
    const ranked=real.rank({dice,locked,mask,roll,extra,sumSN:s});
    for(const action of ranked){
     const expected=action.type==='score'?stop(2,roll):holdEV(action.held[n-1],action.held.reduce((a,b)=>a+b,0)-action.held[n-1],roll,extra);
     near(action.ev,expected,'REAL independent school action');
    }
    near(ranked[0].ev,best(2,1,1,roll,extra),'REAL independent school optimum');oracleRanks++;
   }
  }
 }
 console.log(`REAL independent binomial oracle: ${oracleBoundaries} boundaries; ${oracleRanks} school ranks`);
 const times=[],hotTimes=[];let bellmanChecks=0;
 for(const mask of [8191,8190,127,128,4096,4097,2730,5461])for(const sumSN of ((mask>>7)===63?[0]:[0,1,-1,10,11])){
  if(!m.sumsByRemaining[mask>>7].includes(sumSN))continue;
  const rolls=real.solve(mask,sumSN);
  for(const extra of [false,true]){
   const ev=real.expectation(rolls[+extra][0])[0];near(ev,real.value(mask,extra,sumSN),'REAL mixed Bellman boundary');bellmanChecks++;
   for(const roll of [1,2,3,4]){
    if(roll===4&&extra)continue;
    for(const locked of [Array(5).fill(false),[true,false,true,false,false],Array(5).fill(true)]){
     const state={...base,mask,sumSN,roll,extra,locked};
     real.cache.clear();let start=performance.now();real.rank(state);times.push(performance.now()-start);
     start=performance.now();real.rank(state);hotTimes.push(performance.now()-start);
    }
   }
  }
 }
 console.log(`REAL mixed Bellman boundary checks: ${bellmanChecks}`);
 console.log(`REAL cold/hot ranks (${times.length} each): max ${Math.max(...times).toFixed(2)} / ${Math.max(...hotTimes).toFixed(2)} ms`);
 assert.ok(Math.max(...times)<=1000,'actual-model Node rank <=1 second');
 console.log('PASS REAL MODEL regression and benchmark');
}
