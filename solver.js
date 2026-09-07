/* Exact within-turn expectimax; whole-game continuation values exported from Python. */
(function(root){
'use strict';
const names=['Para','Dwie pary','Trójka','Street','Full','Kareta','Poker'];
const sum=a=>a.reduce((x,y)=>x+y,0);
const key=a=>a.join(',');
function vectors(n,d=6){if(d===1)return [[n]];let out=[];for(let i=0;i<=n;i++)for(const tail of vectors(n-i,d-1))out.push([i,...tail]);return out;}
function points(t,c,first){let v=0;
 if([0,2,5,6].includes(c)){const n=({0:2,2:3,5:4,6:5})[c];for(let j=0;j<6;j++)if(t[j]>=n)v=Math.max(v,n*(j+1));}
 if(c===1)for(let a=0;a<6;a++)for(let b=0;b<6;b++)if(t[a]>=2&&t[b]>=2&&(a!==b||t[a]>=4))v=Math.max(v,2*(a+b+2));
 if(c===4)for(let a=0;a<6;a++)for(let b=0;b<6;b++)if(t[a]>=3&&t[b]>=2&&(a!==b||t[a]>=5))v=Math.max(v,3*(a+1)+2*(b+1));
 if(c===3){if(t.slice(0,5).every(x=>x===1))v=15;if(t.slice(1).every(x=>x===1))v=20;}
 return v*(first?2:1)+(c===6&&v?50:0);
}
class Engine{
 constructor(values){
  this.values=values;this.cache=new Map();this.totals=vectors(5);this.holds=[];
  for(let n=0;n<=5;n++)this.holds.push(...vectors(n));
  this.hmap=new Map(this.holds.map((v,i)=>[key(v),i]));this.tmap=new Map(this.totals.map((v,i)=>[key(v),i]));
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
 expectation(v){const ev=new Float64Array(this.holds.length);for(let h=0;h<ev.length;h++)for(let s=this.ptr[h];s<this.ptr[h+1];s++)ev[h]+=this.prob[s]*v[s];return ev;}
 solve(mask){if(this.cache.has(mask))return this.cache.get(mask);
  const S=this.sh.length,rolls=[[],[]];
  for(let e=0;e<2;e++){
   const stops=[0,1].map(first=>Float64Array.from(this.st,t=>{let best=-Infinity;for(let c=0;c<7;c++)if(mask&(1<<c))best=Math.max(best,this.scores[first][t][c]+this.values[mask^(1<<c)][e]);return best;}));
   rolls[e][3]=stops[0];
   for(let r=2;r>=0;r--){if(r===2&&!e){rolls[e][r]=stops[0];continue;}
    const ev=this.expectation(rolls[r===2?0:e][r+1]);if(r===2)for(let h=0;h<ev.length;h++)ev[h]-=10;
    const bestHold=new Float64Array(S),v=new Float64Array(S);
    for(let s=S-1;s>=0;s--){let best=ev[this.sh[s]];for(const child of this.children[s])best=Math.max(best,bestHold[child]);bestHold[s]=best;v[s]=Math.max(best,stops[r===0?1:0][s]);}rolls[e][r]=v;
   }
  }
  this.cache.set(mask,rolls);return rolls;
 }
 rank({dice,locked,mask,roll,extra}){
  if(!Array.isArray(dice)||dice.length!==5||dice.some(x=>!Number.isInteger(x)||x<1||x>6)||!Array.isArray(locked)||locked.length!==5||locked.some(x=>typeof x!=='boolean')||!Number.isInteger(mask)||mask<0||mask>127||!Number.isInteger(roll)||roll<1||roll>4||typeof extra!=='boolean'||(roll===4&&extra))throw Error('Sprawdź kości, numer rzutu i dostępność dodatkowego rzutu.');
  if(!mask)return [];
  const t=[0,0,0,0,0,0],hv=t.slice();dice.forEach((x,i)=>{t[x-1]++;if(locked[i])hv[x-1]++;});const e=extra?1:0,r=roll-1,out=[];
  for(let c=0;c<7;c++)if(mask&(1<<c)){const future=this.values[mask^(1<<c)][e],p=points(t,c,r===0);if(p>0)out.push({id:'score:'+c,type:'score',category:c,points:p,ev:p+future});out.push({id:'zero:'+c,type:'zero',category:c,points:0,ev:future});}
  if(r<2||(r===2&&e)){
   const rolls=this.solve(mask),ev=this.expectation(rolls[r===2?0:e][r+1]);
   for(let h=0;h<this.holds.length;h++){const held=this.holds[h];if(sum(held)===5||!held.every((x,j)=>x>=hv[j]&&x<=t[j]))continue;
    out.push({id:'hold:'+h,type:'hold',held:held.slice(),reroll:5-sum(held),cost:r===2?10:0,ev:ev[h]-(r===2?10:0)});
   }
  }
  return out.sort((a,b)=>b.ev-a.ev||a.id.localeCompare(b.id));
 }
}
if(typeof module!=='undefined')module.exports={Engine,points};else root.DicePoker={Engine,points,names};
})(typeof window!=='undefined'?window:globalThis);
