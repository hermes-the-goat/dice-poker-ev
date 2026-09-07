'use strict';
importScripts('./solver.js');
let engine;
fetch('./values.json').then(response=>{
 if(!response.ok)throw Error('Nie udało się pobrać tabeli EV. Odśwież stronę.');
 return response.json();
}).then(values=>{
 engine=new DicePoker.Engine(values);self.postMessage({type:'ready'});
}).catch(()=>self.postMessage({type:'fatal',error:'Nie udało się wczytać modelu EV. Odśwież stronę.'}));
self.onmessage=({data:{revision,state}})=>{
 try{self.postMessage({type:'result',revision,all:engine.rank(state)});}
 catch(error){self.postMessage({type:'result',revision,error:error.message});}
};
