'use strict';
const $=id=>document.getElementById(id),names=DicePoker.names;
let engine=null;
const initial=[2,2,6,6,1];
$('dice').innerHTML=initial.map((v,i)=>`<div class="die"><input class="die-value" id="die-${i}" aria-label="Kość ${i+1}: liczba oczek" type="number" min="1" max="6" step="1" inputmode="numeric" value="${v}"><label class="lock-label"><input class="lock" id="lock-${i}" type="checkbox" aria-label="Kość ${i+1} odłożona">Odłożona</label></div>`).join('');
$('categories').innerHTML=names.map((name,c)=>`<label class="category"><input type="checkbox" id="used-${c}"><span>${name}</span></label>`).join('');
const fmt=n=>n.toLocaleString('pl-PL',{minimumFractionDigits:3,maximumFractionDigits:3});
function state(){return {dice:initial.map((_,i)=>Number($('die-'+i).value)),locked:initial.map((_,i)=>$('lock-'+i).checked),mask:names.reduce((m,_,c)=>m|($('used-'+c).checked?0:1<<c),0),roll:Number($('roll').value),extra:$('extra').checked};}
function calculate(){
 if(!engine)return;
 const s=state(),occupied=names.filter((_,c)=>$('used-'+c).checked).length;
 $('turn-badge').textContent=occupied===7?'Koniec gry':`Tura ${occupied+1} / 7`;
 if(s.roll===4){s.extra=false;$('extra').checked=false;}
 $('extra').disabled=s.roll===4;$('paid-note').hidden=s.roll!==4;
 const bank=$('bank').value===''?0:Number($('bank').value);
 try{
  if(!Number.isFinite(bank))throw Error('Wpisz poprawny dotychczasowy wynik.');
  const all=engine.rank(s);$('results').replaceChildren();
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
   $('results').append(card);
  });
 }catch(err){$('results').replaceChildren();$('status').textContent=err.message;}
}
$('calculate').addEventListener('click',calculate);
document.querySelector('.position').addEventListener('change',calculate);
let pending;document.querySelector('.position').addEventListener('input',()=>{clearTimeout(pending);pending=setTimeout(calculate,150);});
$('reset').addEventListener('click',()=>{initial.forEach((v,i)=>{$('die-'+i).value=v;$('lock-'+i).checked=false;});names.forEach((_,c)=>$('used-'+c).checked=false);$('roll').value='1';$('bank').value='0';$('extra').checked=true;$('extra').disabled=false;calculate();});
fetch('./values.json').then(r=>{if(!r.ok)throw Error('Nie udało się pobrać tabeli EV. Odśwież stronę.');return r.json();}).then(values=>{engine=new DicePoker.Engine(values);$('calculate').disabled=false;$('calculate').textContent='Porównaj najlepsze ruchy →';calculate();}).catch(err=>{$('status').textContent=err.message;$('calculate').textContent='Odśwież stronę, aby wczytać model';});
