/* Exact current-turn Szkółka expectimax. Requires the real exported Float64 LUT;
 * no heuristic/fallback model. V contains future rewards/costs and final bonus,
 * never past scores. Geometry uses multiset probabilities, not sampling. */
(function(root){
'use strict';
const names=['Para','Dwie pary','Trójka','Street','Full','Kareta','Poker','S1','S2','S3','S4','S5','S6'];
const sum=a=>a.reduce((x,y)=>x+y,0), key=a=>a.join(',');
const bonus=s=>s<0?-30:s>10?30:0;
function vectors(n,d=6){if(d===1)return [[n]];const out=[];for(let i=0;i<=n;i++)for(const tail of vectors(n-i,d-1))out.push([i,...tail]);return out;}
function points(t,c,first){
 if(c>=7&&c<=12){const n=c-6,m=t[n-1];return n*(m-3)+(first&&m>=3?n:0);}
 let v=0;
 if([0,2,5,6].includes(c)){const n=({0:2,2:3,5:4,6:5})[c];for(let j=0;j<6;j++)if(t[j]>=n)v=Math.max(v,n*(j+1));}
 if(c===1)for(let a=0;a<6;a++)for(let b=0;b<6;b++)if(t[a]>=2&&t[b]>=2&&(a!==b||t[a]>=4))v=Math.max(v,2*(a+b+2));
 if(c===4)for(let a=0;a<6;a++)for(let b=0;b<6;b++)if(t[a]>=3&&t[b]>=2&&(a!==b||t[a]>=5))v=Math.max(v,3*(a+1)+2*(b+1));
 if(c===3){if(t.slice(0,5).every(x=>x===1))v=15;if(t.slice(1).every(x=>x===1))v=20;}
 return v*(first?2:1)+(c===6&&v?50:0);
}
class Engine{
 constructor(metadata,values){
  if(!metadata||metadata.version!==1||metadata.layout!=='standard-school-sum-extra'||metadata.sumStride!==3752||!Array.isArray(metadata.sumOffsets)||metadata.sumOffsets.length!==64||!Array.isArray(metadata.sumsByRemaining)||metadata.sumsByRemaining.length!==64)throw Error('Nieprawidłowy format modelu Szkółki.');
  if(!(values instanceof Float64Array)||values.length!==128*3752*2)throw Error('Nieprawidłowy rozmiar lub typ modelu Float64.');
  if(metadata.dtype!==undefined&&!['float64','Float64','Float64Array','<f8'].includes(metadata.dtype))throw Error('Nieprawidłowy typ modelu.');
  if((metadata.slotCount!==undefined&&metadata.slotCount!==values.length)||(metadata.byteLength!==undefined&&metadata.byteLength!==values.byteLength)||(metadata.endianness!==undefined&&metadata.endianness!=='little')||(metadata.rulesVersion!==undefined&&metadata.rulesVersion!=='school-1'))throw Error('Nieprawidłowy format lub wersja modelu.');
  this.sumOffsets=metadata.sumOffsets.slice();this.sumStride=3752;this.sumIndices=[];
  let offset=0;
  for(let h=0;h<64;h++){
   let reachable=new Set([0]);
   for(let n=1;n<=6;n++)if(!(h&(1<<(n-1)))){const next=new Set();for(const s of reachable)for(let k=-3;k<=3;k++)next.add(s+k*n);reachable=next;}
   const expected=[...reachable].sort((a,b)=>a-b),actual=metadata.sumsByRemaining[h];
   if(this.sumOffsets[h]!==offset||!Array.isArray(actual)||actual.length!==expected.length||actual.some((s,i)=>s!==expected[i]))throw Error('Nieprawidłowe indeksy sum modelu Szkółki.');
   this.sumIndices.push(new Map(actual.map((s,i)=>[s,i])));offset+=actual.length;
  }
  for(const v of values)if(!Number.isFinite(v))throw Error('Model zawiera niefinitywne wartości.');
  this.values=values;
  // Reject zero-filled/corrupt/mismatched assets rather than silently inventing EV.
  for(const [s,i] of this.sumIndices[0])for(let e=0;e<2;e++)if(Math.abs(values[(this.sumOffsets[0]+i)*2+e]-bonus(s))>1e-10)throw Error('Model ma nieprawidłową końcową korektę bonus.');
  this.cache=new Map();this.cacheLimit=16;
  this.totals=vectors(5);this.holds=[];
  for(let n=0;n<=5;n++)this.holds.push(...vectors(n));
  this.hmap=new Map(this.holds.map((v,i)=>[key(v),i]));
  this.sh=[];this.st=[];this.prob=[];this.ptr=[0];this.lookup=this.holds.map(()=>new Int32Array(this.totals.length).fill(-1));
  const fact=[1,1,2,6,24,120];
  for(let h=0;h<this.holds.length;h++){const hv=this.holds[h],n=5-sum(hv);
   for(let t=0;t<this.totals.length;t++){const tv=this.totals[t];if(tv.every((x,j)=>x>=hv[j])){
    this.lookup[h][t]=this.sh.length;this.sh.push(h);this.st.push(t);this.prob.push(fact[n]/tv.reduce((p,x,j)=>p*fact[x-hv[j]],1)/6**n);
   }}this.ptr.push(this.sh.length);
  }
  this.children=this.sh.map((h,s)=>{const hv=this.holds[h],tv=this.totals[this.st[s]],out=[];for(let j=0;j<6;j++)if(hv[j]<tv[j]){const k=hv.slice();k[j]++;out.push(this.lookup[this.hmap.get(key(k))][this.st[s]]);}return out;});
  this.scores=[false,true].map(first=>this.totals.map(t=>names.map((_,c)=>points(t,c,first))));
 }
 index(mask,sumSN){
  if(!Number.isInteger(mask)||mask<0||mask>8191)throw Error('Nieprawidłowa maska kategorii.');
  const h=mask>>7,i=this.sumIndices[h].get(sumSN);
  if(!Number.isInteger(sumSN)||i===undefined)throw Error('Nieosiągalna suma szkółek dla tej maski.');
  return ((mask&127)*this.sumStride+this.sumOffsets[h]+i)*2;
 }
 // Public boundary continuation V(mask, extra, sumSN); extra is a boolean.
 value(mask,extra,sumSN){
  if(typeof extra!=='boolean')throw Error('Nieprawidłowa dostępność dodatkowego rzutu.');
  return this.values[this.index(mask,sumSN)+(extra?1:0)];
 }
 expectation(v){const ev=new Float64Array(this.holds.length);for(let h=0;h<ev.length;h++)for(let s=this.ptr[h];s<this.ptr[h+1];s++)ev[h]+=this.prob[s]*v[s];return ev;}
 solve(mask,sumSN){
  this.index(mask,sumSN);if(!mask)throw Error('Brak kategorii do rozwiązania.');
  const cacheKey=mask+':'+sumSN;
  if(this.cache.has(cacheKey)){const cached=this.cache.get(cacheKey);this.cache.delete(cacheKey);this.cache.set(cacheKey,cached);return cached;}
  const S=this.sh.length,rolls=[[],[]];
  for(let e=0;e<2;e++){
   // Only 252 stop calculations per first-roll flag, not 4368 repeated pairs.
   const stops=[0,1].map(first=>{
    const byTotal=Float64Array.from(this.totals,(_,t)=>{
     let best=-Infinity;
     for(let c=0;c<13;c++)if(mask&(1<<c)){
      const p=this.scores[first][t][c];
      best=Math.max(best,p+this.value(mask^(1<<c),!!e,sumSN+(c>=7?p:0)));
     }
     return best;
    });
    return Float64Array.from(this.st,t=>byTotal[t]);
   });
   rolls[e][3]=stops[0];
   for(let r=2;r>=0;r--){if(r===2&&!e){rolls[e][r]=stops[0];continue;}
    const ev=this.expectation(rolls[r===2?0:e][r+1]);if(r===2)for(let h=0;h<ev.length;h++)ev[h]-=10;
    const bestHold=new Float64Array(S),v=new Float64Array(S);
    // Reverse topological superset max preserves every permanent lock.
    // The five-held self-loop is harmless: another roll cannot improve it
    // (first-roll score dominates later score, purchased roll also costs 10).
    for(let s=S-1;s>=0;s--){let best=ev[this.sh[s]];for(const child of this.children[s])best=Math.max(best,bestHold[child]);bestHold[s]=best;v[s]=Math.max(best,stops[r===0?1:0][s]);}
    rolls[e][r]=v;
   }
  }
  this.cache.set(cacheKey,rolls);if(this.cache.size>this.cacheLimit)this.cache.delete(this.cache.keys().next().value);
  return rolls;
 }
 rank({dice,locked,mask,roll,extra,sumSN}){
  if(!Array.isArray(dice)||dice.length!==5||dice.some(x=>!Number.isInteger(x)||x<1||x>6)||!Array.isArray(locked)||locked.length!==5||locked.some(x=>typeof x!=='boolean')||!Number.isInteger(roll)||roll<1||roll>4||typeof extra!=='boolean'||(roll===4&&extra))throw Error('Sprawdź kości, numer rzutu i dostępność dodatkowego rzutu.');
  this.index(mask,sumSN);if(!mask)return [];
  const t=[0,0,0,0,0,0],hv=t.slice();dice.forEach((x,i)=>{t[x-1]++;if(locked[i])hv[x-1]++;});const e=extra?1:0,r=roll-1,out=[];
  for(let c=0;c<13;c++)if(mask&(1<<c)){
   const p=points(t,c,r===0),future=this.value(mask^(1<<c),extra,sumSN+(c>=7?p:0));
   if(c>=7||p>0)out.push({id:'score:'+c,type:'score',category:c,points:p,ev:p+future});
   if(c<7)out.push({id:'zero:'+c,type:'zero',category:c,points:0,ev:future});
  }
  if(r<2||(r===2&&e)){
   const rolls=this.solve(mask,sumSN),ev=this.expectation(rolls[r===2?0:e][r+1]);
   for(let h=0;h<this.holds.length;h++){const held=this.holds[h],n=sum(held);if(n===5||!held.every((x,j)=>x>=hv[j]&&x<=t[j]))continue;
    out.push({id:'hold:'+h,type:'hold',held:held.slice(),reroll:5-n,cost:r===2?10:0,ev:ev[h]-(r===2?10:0)});
   }
  }
  return out.sort((a,b)=>b.ev-a.ev||a.id.localeCompare(b.id));
 }
}
const api={Engine,points,names};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
root.DicePokerSchool=api;
})(typeof window!=='undefined'?window:globalThis);
