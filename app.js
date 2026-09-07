'use strict';
const $=id=>document.getElementById(id),names=DicePoker.names;
let worker=null,ready=false,busy=false,revision=0,request=null;
const initial=[2,2,6,6,1];
$('dice').innerHTML=initial.map((v,i)=>`<div class="die"><input class="die-value" id="die-${i}" aria-label="Kość ${i+1}: liczba oczek" type="text" inputmode="numeric" pattern="[1-6]" value="${v}"><label class="lock-label"><input class="lock" id="lock-${i}" type="checkbox" aria-label="Kość ${i+1} odłożona">Odłożona</label></div>`).join('');
$('categories').innerHTML=names.map((name,c)=>`<div class="category"><label class="category-used"><input type="checkbox" id="used-${c}"><span>${name}</span></label><input class="category-score" id="score-${c}" type="number" min="0" step="1" inputmode="numeric" placeholder="—" aria-label="${name}: punkty (opcjonalnie)" aria-describedby="score-help score-error"></div>`).join('');
const scores=names.map(()=>null);
function readBank(){const input=$('bank'),value=input.value===''?0:Number(input.value);return input.validity.badInput||!Number.isFinite(value)?null:value;}
// Apply only valid, complete edits. The bank minus recorded scores is the manual
// offset (earlier points / paid throw); score corrections must preserve it.
function reconcileScores(){
 const next=names.map((_,c)=>{const input=$('score-'+c);return input.value===''&&!input.validity.badInput?null:Number(input.value);});
 const invalid=names.findIndex((_,c)=>!$('score-'+c).validity.valid||(next[c]!==null&&(!Number.isSafeInteger(next[c])||next[c]<0)));
 const bank=readBank(),delta=next.reduce((sum,value,c)=>sum+(value??0)-(scores[c]??0),0);
 if(invalid!==-1||bank===null||!Number.isSafeInteger(next.reduce((sum,n)=>sum+(n??0),0))||!Number.isFinite(bank+delta)){
  $('score-error').textContent=invalid!==-1?'Wpisz nieujemną, całkowitą liczbę punktów albo zostaw pole puste.':bank===null?'Wpisz poprawny bank netto przed zmianą punktów.':'Wynik jest zbyt duży. Zmniejsz liczbę punktów.';
  names.forEach((_,c)=>$('score-'+c).setAttribute('aria-invalid',String(c===invalid)));
  return false;
 }
 if(delta!==0)$('bank').value=String(bank+delta);
 next.forEach((value,c)=>{scores[c]=value;if(value!==null)$('used-'+c).checked=true;$('score-'+c).setAttribute('aria-invalid','false');});
 $('score-total').textContent=String(scores.reduce((sum,n)=>sum+(n??0),0));$('score-error').textContent='';return true;
}
function editPosition(event){
 if(event.target.id.startsWith('used-')&&!event.target.checked)$('score-'+event.target.id.slice(5)).value='';
 reconcileScores();invalidate();
}
const fmt=n=>n.toLocaleString('pl-PL',{minimumFractionDigits:3,maximumFractionDigits:3});
function state(){return {dice:initial.map((_,i)=>Number($('die-'+i).value)),locked:initial.map((_,i)=>$('lock-'+i).checked),mask:names.reduce((m,_,c)=>m|($('used-'+c).checked?0:1<<c),0),roll:Number($('roll').value),extra:$('extra').checked};}
function syncControls(){
 const occupied=names.filter((_,c)=>$('used-'+c).checked).length,paid=$('roll').value==='4';
 $('turn-badge').textContent=occupied===7?'Koniec gry':`Tura ${occupied+1} / 7`;
 if(paid)$('extra').checked=false;
 $('extra').disabled=paid;$('paid-note').hidden=!paid;
 const s=state(),allLocked=s.locked.every(Boolean);
 $('random-remaining').disabled=allLocked||s.roll>=4||(s.roll===3&&!s.extra);
 $('random-help').textContent=allLocked?'Wszystkie kości są odłożone — nie ma czego przerzucić.':s.roll>=4?'Wykorzystano 4 rzuty — zapisz wynik lub rozpocznij nową turę.':s.roll===3?(s.extra?'Czwarty rzut wymaga potwierdzenia: koszt 10 pkt z banku, raz na grę.':'Limit 3 rzutów — dodatkowy rzut jest niedostępny.'):'Losuj pozostałe przerzuca tylko nieodłożone kości. Limit: 3 rzuty + jeden płatny czwarty, raz na grę.';
}
function randomize(all){
 const s=state();
 if(!all&&(s.locked.every(Boolean)||s.roll>=4||(s.roll===3&&!s.extra)))return;
 if(!all&&s.roll===3){
  const bank=readBank();
  if(bank===null){$('random-help').textContent='Wpisz poprawny bank netto przed zakupem rzutu.';return;}
  if(!window.confirm('Kupić czwarty rzut za 10 pkt? Odejmę 10 pkt z banku. Dodatkowy rzut jest dostępny tylko raz na grę.'))return;
  $('bank').value=String(bank-10);$('extra').checked=false;
 }
 initial.forEach((_,i)=>{
  if(all||!s.locked[i])$('die-'+i).value=String(Math.floor(Math.random()*6)+1);
  if(all)$('lock-'+i).checked=false;
 });
 $('roll').value=String(all?1:s.roll+1);
 invalidate();
}
function setBusy(value,label='Porównaj najlepsze ruchy →'){
 busy=value;$('calculate').disabled=value||!ready;
 $('calculate').setAttribute('aria-busy',String(value));
 $('calculate-label').textContent=value?'Obliczanie…':label;
}
function invalidate(){
 revision++;syncControls();$('freshness').textContent='Nieaktualne';
 document.querySelectorAll('.save-score').forEach(button=>{button.disabled=true;});
 document.querySelectorAll('.save-hint[data-recordable]').forEach(hint=>{hint.textContent='Pozycja zmieniona — porównaj ruchy ponownie.';});
}
function showError(message){
 $('results').replaceChildren();$('status').textContent=message;$('freshness').textContent='Nieaktualne';
}
function calculate(){
 if(!ready||busy)return;
 if(!reconcileScores()){showError($('score-error').textContent);return;}
 syncControls();
 const s=state(),bank=$('bank').value===''?0:Number($('bank').value);
 if($('bank').validity.badInput||!Number.isFinite(bank)){showError('Wpisz poprawny dotychczasowy wynik.');return;}
 request={revision,s,bank,occupied:names.filter((_,c)=>$('used-'+c).checked).length};
 setBusy(true);
 try{worker.postMessage({revision,state:s});}catch{fatal('Nie udało się uruchomić obliczeń. Odśwież stronę.');}
}
function render(all,{s,bank,occupied,revision:resultRevision}){
  $('results').replaceChildren();
  if(!all.length){$('status').textContent=`Wszystkie kategorie są zajęte. Gra zakończona — wynik: ${bank} pkt.`;return;}
  const top=all.slice(0,3);
  $('status').textContent=`Porównano ${all.length} legalnych ruchów. EV obejmuje obecną turę i ${6-occupied} kolejnych.`;
  top.forEach((a,i)=>{
   let title,detail;
   if(a.type==='hold'){
    const held=a.held.flatMap((n,j)=>Array(n).fill(j+1));
    title=held.length?`Odłóż łącznie: ${held.join(' · ')}`:'Przerzuć wszystkie kości';
    detail=`${a.cost?'Kup czwarty rzut za 10 pkt. ':''}Liczba kości do przerzutu: ${a.reroll}. ${held.length?'Wcześniejsze blokady pozostają zachowane.':'Nie odkładaj żadnej kości.'}`;
   }else{title=a.type==='zero'?`Skreśl: ${names[a.category]}`:`Zapisz: ${names[a.category]} · ${a.points} pkt`;detail=a.type==='zero'?'Zakończ turę za 0 pkt i zużyj tę kategorię.':`Zakończ turę.${s.roll===1?' Premia pierwszego rzutu jest już w punktacji.':''}`;}
   const delta=top[0].ev-a.ev,card=document.createElement('article');card.className='move'+(i===0?' best':'');
   card.innerHTML=`<div class="move-top"><span class="rank">${i+1}. ${i===0?'NAJLEPSZY RUCH':'ALTERNATYWA'}</span><span class="delta">${delta<1e-9?'Najwyższe EV':'−'+fmt(delta)+' pkt EV'}</span></div><h3>${title}</h3><p>${detail}</p><div class="ev-row"><div><div class="ev-number">${fmt(a.ev)} <small>pkt</small></div><div class="ev-label">EV od teraz do końca</div></div><div class="end-score">Przewidywana suma<b>${fmt(bank+a.ev)} pkt</b></div></div>`;
   const button=document.createElement('button'),hint=document.createElement('p');
   const recordable=a.type==='score'||a.type==='zero';
   button.type='button';button.className='save-score';button.textContent='Zapisz punkty';button.disabled=!recordable;
   hint.className='save-hint';hint.id=`save-hint-${i}`;button.setAttribute('aria-describedby',hint.id);
   hint.textContent=recordable?'Do tabeli i banku trafią punkty figury, nie EV.':'Najpierw wykonaj rzut';
   if(recordable)hint.dataset.recordable='true';
   let saved=false;
   button.addEventListener('click',()=>{
    if(!recordable||saved||resultRevision!==revision||busy)return;
    const c=a.category,points=a.type==='zero'?0:a.points;
    if(!Number.isInteger(c)||c<0||c>=names.length||$('used-'+c).checked||scores[c]!==null||$('score-'+c).value!==''||!Number.isSafeInteger(points)||points<0)return;
    if(!reconcileScores())return;
    $('score-'+c).value=String(points);
    if(!reconcileScores()){$('score-'+c).value='';return;}
    saved=true;invalidate();
    $('status').textContent=`Zapisano: ${names[c]} · ${points} pkt. Kości i numer rzutu pozostają bez zmian — ustaw kolejną pozycję ręcznie.`;
   });
   card.append(button,hint);$('results').append(card);
  });
}
// Text inputs support selection ranges; inputmode keeps the mobile numeric keyboard.
// Move synchronously on input so rapid typing (including soft keyboards) is not lost.
document.querySelectorAll('.die-value').forEach((input,i)=>input.addEventListener('input',()=>{
 if(!/^[1-6]$/.test(input.value))return;
 const next=$('die-'+(i+1));
 if(next){next.focus();next.select();}
}));
$('random-all').addEventListener('click',()=>randomize(true));
$('random-remaining').addEventListener('click',()=>randomize(false));
syncControls();
$('calculate').addEventListener('click',calculate);
document.querySelector('.position').addEventListener('change',editPosition);
document.querySelector('.position').addEventListener('input',editPosition);
$('reset').addEventListener('click',()=>{initial.forEach((v,i)=>{$('die-'+i).value=v;$('lock-'+i).checked=false;});names.forEach((_,c)=>{$('used-'+c).checked=false;$('score-'+c).value='';scores[c]=null;});$('roll').value='1';$('bank').value='0';$('extra').checked=true;reconcileScores();invalidate();});
function fatal(message){
 ready=false;request=null;worker?.terminate();setBusy(false,'Odśwież stronę, aby wczytać model');showError(message);
}
try{
 worker=new Worker('./solver-worker.js');
 worker.onmessage=({data})=>{
  if(data.type==='fatal'){fatal(data.error);return;}
  if(data.type==='ready'){ready=true;setBusy(false);calculate();return;}
  if(!request||data.revision!==request.revision)return;
  const completed=request;request=null;
  try{
   // Never publish results (or errors) for inputs changed while the worker ran.
   if(completed.revision!==revision)return;
   if(data.error){showError(data.error);return;}
   render(data.all,completed);$('freshness').textContent='Aktualne';
  }catch{showError('Nie udało się wyświetlić wyniku. Spróbuj ponownie.');}
  finally{setBusy(false);}
 };
 worker.onerror=event=>{event.preventDefault();fatal('Nie udało się uruchomić modelu. Odśwież stronę.');};
 worker.onmessageerror=()=>fatal('Nie udało się odczytać wyniku. Odśwież stronę.');
}catch{fatal('Nie udało się uruchomić modelu. Odśwież stronę.');}
