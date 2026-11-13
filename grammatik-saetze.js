(()=>{
'use strict';
const $=id=>document.getElementById(id);
const personalized=new URLSearchParams(location.search).get('personalisiert')==='1';
const back='uebung.html'+(personalized?'?personalisiert=1':'')+'#grammatik';
$('homeLink').href=back;$('backLink').href=back;
$('orderLink').href='grammatik-saetze-ordnen.html'+(personalized?'?personalisiert=1':'');
const client=window.supabase?.createClient('https://jzolxrqrrljwpmjbdxmo.supabase.co','sb_publishable_AGUrdmy8nEQZJlPfgd9qbw_J6xkojrj',{auth:{storageKey:'avanza-student-auth-token',persistSession:true,autoRefreshToken:true}});
if(client)window.avanzaStudentClient=client;
let bank=[],round=[],index=0,history=[],locked=false,running=false,sessionId=null,loggedIn=false,lastInteraction=Date.now();
let trackingQueue=Promise.resolve();
const shuffle=list=>{const out=[...list];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]]}return out};
function show(id){for(const name of ['menu','setup','exercise','result'])$(name).hidden=name!==id;window.scrollTo({top:0,behavior:'instant'})}
function note(){lastInteraction=Date.now()}
['pointerdown','keydown'].forEach(name=>document.addEventListener(name,note,{passive:true}));
async function invoke(name,body){const {data,error}=await client.functions.invoke(name,{body});if(error||data?.error)throw Error(data?.error||error.message);return data}
function enqueue(job){trackingQueue=trackingQueue.then(job).catch(()=>{$('saveStatus').textContent='Lernzeit oder Ergebnis konnte gerade nicht gespeichert werden.'});return trackingQueue}
function startTracking(){return enqueue(async()=>{if(!client||!running||document.visibilityState!=='visible'||sessionId)return;const {data}=await client.auth.getSession();loggedIn=!!data?.session;if(!loggedIn){$('saveStatus').textContent='Ohne Anmeldung wird dein Lernfortschritt nicht gespeichert.';return}const result=await invoke('learning-activity',{action:'start',activityType:'grammar',mode:'extra',groupKey:'Satzübungen · Multiple Choice'});sessionId=result.sessionId;})}
function stopTracking(active){return enqueue(async()=>{if(!sessionId)return;const id=sessionId;sessionId=null;await invoke('learning-activity',{action:'end',sessionId:id,active});})}
setInterval(()=>{if(!running||document.visibilityState!=='visible')return;if(Date.now()-lastInteraction>90000){void stopTracking(false);return}if(!sessionId){void startTracking();return}void enqueue(async()=>{if(sessionId)await invoke('learning-activity',{action:'ping',sessionId})})},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void stopTracking(false);else if(running){note();void startTracking()}});
window.addEventListener('pagehide',()=>{running=false;void stopTracking(false)});
function record(row,correct){if(!client)return;void enqueue(async()=>{if(!loggedIn)return;await invoke('student-progress',{action:'record',itemType:'grammar',groupKey:'Satzübungen · '+row.topic,itemKey:'sentence-mc:'+row.id,itemLabel:row.de,correct,sessionId:sessionId||undefined});$('saveStatus').textContent='Lernfortschritt gespeichert.'})}
// Cycle through each topic's sentences before reusing them. Failure to access
// browser storage must never prevent an exercise from starting.
function selectRound(){
 const selected=[...document.querySelectorAll('.topics input:checked')].map(x=>x.value);
 if(!selected.length){$('loadStatus').textContent='Bitte wähle mindestens ein Grammatikthema.';return null}
 const candidates=bank.filter(r=>selected.includes(r.topic));const count=$('amount').value==='all'?candidates.length:Math.min(Number($('amount').value),candidates.length);
 let seen=[];try{seen=JSON.parse(localStorage.getItem('avanza-sentence-mc-seen-v1')||'[]');if(!Array.isArray(seen))seen=[]}catch{}
 const ids=new Set(seen);const fresh=shuffle(candidates.filter(r=>!ids.has(r.id)));const old=shuffle(candidates.filter(r=>ids.has(r.id)));
 return fresh.concat(old).slice(0,count);
}
function remember(row){try{let seen=JSON.parse(localStorage.getItem('avanza-sentence-mc-seen-v1')||'[]');if(!Array.isArray(seen))seen=[];let ids=new Set(seen);const topicRows=bank.filter(r=>r.topic===row.topic);if(topicRows.every(r=>ids.has(r.id)))for(const r of topicRows)ids.delete(r.id);ids.add(row.id);localStorage.setItem('avanza-sentence-mc-seen-v1',JSON.stringify([...ids]))}catch{}}
function start(rows){if(!rows?.length)return;round=rows;index=0;history=[];running=true;note();$('saveStatus').textContent='';show('exercise');void startTracking();render()}
function render(){
 const row=round[index];locked=false;$('topicHeading').textContent=row.topic;$('position').textContent='Aufgabe '+(index+1)+' von '+round.length;$('correctCount').textContent=history.filter(x=>x.correct).length+' richtig';$('prompt').textContent=row.de;$('progress').max=round.length;$('progress').value=history.length;$('feedback').textContent='';$('feedback').className='feedback';$('nextBtn').hidden=true;$('nextBtn').textContent=index===round.length-1?'Ergebnisse ansehen':'Weiter';$('answers').replaceChildren();
 for(const text of shuffle(row.opts)){const button=document.createElement('button');button.type='button';button.className='answer';button.lang='es';button.textContent=text;button.addEventListener('click',()=>answer(row,text,button));$('answers').append(button)}
 $('topicHeading').focus({preventScroll:true});
}
function answer(row,text,button){
 if(locked||!running)return;locked=true;const correct=text===row.es;history.push({row,text,correct});remember(row);
 for(const b of $('answers').children){b.disabled=true;if(b.textContent===row.es)b.classList.add('correct')}
 if(!correct)button.classList.add('incorrect');
 $('feedback').className='feedback '+(correct?'good':'bad');$('feedback').textContent=correct?'✓ Richtig.':'✕ '+(text===row.wrong1?row.reason1:row.reason2)+' Richtig: '+row.es;
 $('correctCount').textContent=history.filter(x=>x.correct).length+' richtig';$('progress').value=history.length;$('nextBtn').hidden=false;record(row,correct);
}
function finish(){if(!running)return;running=false;void stopTracking(document.visibilityState==='visible'&&Date.now()-lastInteraction<=90000);show('result');const correct=history.filter(x=>x.correct).length;$('score').textContent=history.length?correct+' von '+history.length+' richtig · '+Math.round(correct/history.length*100)+' %':'Noch keine Aufgabe beantwortet.';$('repeatBtn').hidden=!history.some(x=>!x.correct);$('reviewList').replaceChildren();document.querySelector('.review').open=false;
 for(const item of history){const article=document.createElement('article');const prompt=document.createElement('strong');prompt.textContent=item.row.de;article.append(prompt);const chosen=document.createElement('p');chosen.lang='es';chosen.className=item.correct?'good-text':'bad-text';chosen.textContent=(item.correct?'✓ ':'✕ ')+item.text;article.append(chosen);if(!item.correct){const solution=document.createElement('p');solution.lang='es';solution.textContent='✓ '+item.row.es;solution.className='good-text';article.append(solution)}$('reviewList').append(article)}
}
$('mcBtn').onclick=()=>show('setup');$('menuBtn').onclick=()=>show('menu');$('selectionBtn').onclick=()=>show('setup');$('startBtn').onclick=()=>start(selectRound());$('againBtn').onclick=()=>start(selectRound());$('repeatBtn').onclick=()=>start(shuffle(history.filter(x=>!x.correct).map(x=>x.row)));$('finishBtn').onclick=finish;$('nextBtn').onclick=()=>{if(!locked)return;if(++index===round.length)finish();else render()};
Promise.all(['grammatik-saetze-daten.json','grammatik-saetze-a2.json','grammatik-saetze-subjuntivo.json','grammatik-saetze-rest.json'].map(path=>fetch(path,{cache:'no-store'}).then(response=>{if(!response.ok)throw Error();return response.json()}))).then(sources=>{bank=sources.flatMap(data=>data.sentences||[]);if(!Array.isArray(bank)||bank.length<1300||new Set(bank.map(r=>r.id)).size!==bank.length||bank.some(r=>!r.id||r.opts?.length!==3||new Set(r.opts).size!==3||r.opts.filter(x=>x===r.es).length!==1))throw Error();$('startBtn').disabled=false;$('loadStatus').textContent=''}).catch(()=>{$('loadStatus').className='error';$('loadStatus').textContent='Die Sätze konnten nicht geladen werden. Bitte lade die Seite erneut.'});
})();
