'use strict';
let engine,activeMode;
self.onmessage=async({data})=>{
 const {type,mode,id,revision,state}=data;
 if(type==='load'){
  activeMode=mode;
  try{
   if(mode==='school'){
    importScripts('./school-solver.js');
    const [metadataResponse,valuesResponse]=await Promise.all([fetch('./school-model.json'),fetch('./school-values.bin')]);
    if(!metadataResponse.ok||!valuesResponse.ok)throw Error('Brak modelu');
    const [metadata,buffer]=await Promise.all([metadataResponse.json(),valuesResponse.arrayBuffer()]);
    if(typeof metadata.sha256!=='string'||!/^[a-f0-9]{64}$/.test(metadata.sha256))throw Error('Nieprawidłowa suma SHA-256 modelu.');
    const digest=await crypto.subtle.digest('SHA-256',buffer);
    const sha256=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(sha256!==metadata.sha256)throw Error('Niezgodna suma SHA-256 modelu.');
    engine=new DicePokerSchool.Engine(metadata,new Float64Array(buffer));
   }else if(mode==='standard'){
    importScripts('./solver.js');
    const response=await fetch('./values.json');if(!response.ok)throw Error('Brak modelu');
    engine=new DicePoker.Engine(await response.json());
   }else throw Error('Nieznany wariant');
   self.postMessage({type:'ready',mode,id});
  }catch(error){self.postMessage({type:'fatal',mode,id,error:`Nie udało się wczytać modelu EV${mode==='school'?' Szkółki':''}. Odśwież stronę lub przełącz wariant i spróbuj ponownie.`});}
  return;
 }
 if(type!=='rank'||mode!==activeMode)return;
 try{if(!engine)throw Error('Model nie jest gotowy.');self.postMessage({type:'result',mode,id,revision,all:engine.rank(state)});}
 catch(error){self.postMessage({type:'result',mode,id,revision,error:error.message});}
};
