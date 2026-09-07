const assert=require('node:assert/strict');
const fs=require('node:fs');
assert(fs.existsSync(__dirname+'/solver.js'),'Missing solver');
const {Engine}=require('./solver.js');
const values=JSON.parse(fs.readFileSync(__dirname+'/values.json'));
const engine=new Engine(values);
const fixtures=JSON.parse(fs.readFileSync(__dirname+'/fixtures.json'));
for(const f of fixtures){
 const result=engine.rank(f.input);
 assert.equal(result.length,f.actions.length);
 const expected=new Map(f.actions.map(x=>[x.id,x.ev]));
 for(const a of result)assert(Math.abs(a.ev-expected.get(a.id))<1e-8,JSON.stringify({input:f.input,a,expected:expected.get(a.id)}));
 for(let i=1;i<result.length;i++)assert(result[i-1].ev>=result[i].ev-1e-10);
}
assert.throws(()=>engine.rank({dice:[0,1,2,3,4],locked:[false,false,false,false,false],mask:127,roll:1,extra:true}));
assert.deepEqual(engine.rank({dice:[1,2,3,4,5],locked:[false,false,false,false,false],mask:0,roll:1,extra:true}),[]);
console.log('PASS: all actions match independent Python policy evaluation for '+fixtures.length+' positions.');
