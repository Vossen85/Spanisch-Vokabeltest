(()=>{
'use strict';
const $=id=>document.getElementById(id);
const personalized=new URLSearchParams(location.search).get('personalisiert')==='1';
const back='grammatik-saetze.html'+(personalized?'?personalisiert=1':'');
$('homeLink').href=back;
$('backLink').href=back;
const client=window.supabase?.createClient('https://jzolxrqrrljwpmjbdxmo.supabase.co','sb_publishable_AGUrdmy8nEQZJlPfgd9qbw_J6xkojrj',{auth:{storageKey:'avanza-student-auth-token',persistSession:true,autoRefreshToken:true}});
if(client)window.avanzaStudentClient=client;
const seenKey='avanza-sentence-error-seen-v1';
let bank=[],round=[],position=0,history=[],running=false,locked=false;
let attempts=0,sessionId=null,loggedIn=false,lastInteraction=Date.now();
let alternatives={};
let trackingQueue=Promise.resolve();
const shuffle=arr=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const tokens=s=>String(s||'').normalize('NFC').match(/[\p{L}\p{M}\p{N}]+/gu)||[];
const normalizeSentence=s=>tokens(s).map(word=>word.toLocaleLowerCase('es-ES')).join('\u001f');
function show(page){for(const id of ['setup','exercise','result'])$(id).hidden=id!==page;window.scrollTo({top:0,behavior:'instant'})}
function note(){lastInteraction=Date.now()}
['pointerdown','keydown'].forEach(type=>document.addEventListener(type,note,{passive:true}));
async function invoke(name,body){const {data,error}=await client.functions.invoke(name,{body});if(error||data?.error)throw Error(data?.error||error.message);return data}
function enqueue(job){trackingQueue=trackingQueue.then(job).catch(()=>{$('saveStatus').textContent='Lernzeit oder Ergebnis konnte gerade nicht gespeichert werden.'});return trackingQueue}
function startTracking(){return enqueue(async()=>{if(!client||!running||document.visibilityState!=='visible'||sessionId)return;const {data}=await client.auth.getSession();loggedIn=!!data?.session;if(!loggedIn){$('saveStatus').textContent='Ohne Anmeldung wird dein Lernfortschritt nicht gespeichert.';return}const res=await invoke('learning-activity',{action:'start',activityType:'grammar',mode:'extra',groupKey:'Satzübungen · Fehler korrigieren'});sessionId=res.sessionId})}
function stopTracking(active){return enqueue(async()=>{if(!sessionId)return;const id=sessionId;sessionId=null;await invoke('learning-activity',{action:'end',sessionId:id,active})})}
setInterval(()=>{if(!running||document.visibilityState!=='visible')return;if(Date.now()-lastInteraction>90000){void stopTracking(false);return}if(!sessionId){void startTracking();return}void enqueue(async()=>{if(sessionId)await invoke('learning-activity',{action:'ping',sessionId})})},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void stopTracking(false);else if(running){note();void startTracking()}});
window.addEventListener('pagehide',()=>{running=false;void stopTracking(false)});
function record(row,correct){if(!client)return;void enqueue(async()=>{if(!loggedIn)return;await invoke('student-progress',{action:'record',itemType:'grammar',groupKey:'Satzfehler · '+row.topic,itemKey:'sentence-error:'+row.id,itemLabel:row.de,correct,sessionId:sessionId||undefined});$('saveStatus').textContent='Lernfortschritt gespeichert.'})}
function selectedTopics(){return [...$('topics').querySelectorAll('input:checked')].map(el=>el.value)}
function selection(){const topics=selectedTopics();if(!topics.length){$('loadStatus').textContent='Bitte wähle mindestens ein Grammatikthema.';return null}const eligible=bank.filter(row=>topics.includes(row.topic)),n=$('amount').value==='all'?eligible.length:Math.min(Number($('amount').value),eligible.length);let seen=[];try{seen=JSON.parse(localStorage.getItem(seenKey)||'[]');if(!Array.isArray(seen))seen=[]}catch{}const old=new Set(seen);return shuffle(eligible.filter(row=>!old.has(row.id))).concat(shuffle(eligible.filter(row=>old.has(row.id)))).slice(0,n)}
function remember(row){try{let items=JSON.parse(localStorage.getItem(seenKey)||'[]');if(!Array.isArray(items))items=[];const set=new Set(items);const topicRows=bank.filter(x=>x.topic===row.topic);if(topicRows.every(x=>set.has(x.id)))for(const x of topicRows)set.delete(x.id);set.add(row.id);localStorage.setItem(seenKey,JSON.stringify([...set]))}catch{}}
function begin(rows){if(!rows?.length)return;round=rows;position=0;history=[];running=true;locked=false;$('saveStatus').textContent='';note();show('exercise');void startTracking();render()}
function updateButtons(){
  const hasSentence=!!$('correctionInput').value.trim();
  $('checkBtn').disabled=locked||!hasSentence;
  $('resetBtn').disabled=locked||!hasSentence;
}
function render(){
 const row=round[position];locked=false;attempts=0;
 $('topicHeading').textContent=row.topic;$('phenomenon').textContent=row.phen||'';
 $('position').textContent='Aufgabe '+(position+1)+' von '+round.length;
 $('correctCount').textContent=history.filter(x=>x.correct).length+' richtig';
 $('progress').value=history.length;$('progress').max=round.length;
 $('prompt').textContent=row.de;
 $('spanishSentence').textContent=row.error.wrong;
 $('correctionInput').value='';$('correctionInput').readOnly=false;
 $('feedback').textContent='';$('feedback').className='feedback';
 $('solution').textContent='';$('solution').hidden=true;
 $('checkBtn').hidden=false;$('resetBtn').hidden=false;
 $('nextBtn').hidden=true;$('nextBtn').textContent=position===round.length-1?'Ergebnisse ansehen':'Weiter';
 $('chars').querySelectorAll('button').forEach(b=>b.disabled=false);
 updateButtons();$('topicHeading').focus({preventScroll:true});
}
function submit(){
 if(!running||locked||!$('correctionInput').value.trim())return;
 const row=round[position],error=row.error,entered=$('correctionInput').value.trim();
 const answer=normalizeSentence(entered);
 const valid=[row.es,...(alternatives[row.id]||[])].map(normalizeSentence);
 const correct=valid.includes(answer);
 attempts++;
 if(!correct&&attempts===1){
  $('feedback').className='feedback';
  $('feedback').textContent='Noch nicht ganz richtig. Prüfe den gesamten Satz und besonders die Verbform. Du hast einen zweiten Versuch.';
  $('correctionInput').focus();
  return;
 }
 locked=true;history.push({row,correct,entered,attempts});remember(row);
 $('progress').value=history.length;
 $('correctCount').textContent=history.filter(x=>x.correct).length+' richtig';
 $('feedback').className='feedback '+(correct?'good':'bad');
 $('feedback').textContent=correct?(attempts===1?'✓ Richtig! Der ganze Satz stimmt.':'✓ Im zweiten Versuch richtig!'):
  '✕ Noch nicht ganz richtig. '+error.reason+' Die Verbform muss „'+error.correctWord+'“ statt „'+error.incorrectWord+'“ heißen.';
 $('solution').textContent='Richtiger Satz: '+row.es;
 $('solution').hidden=false;
 $('correctionInput').readOnly=true;
 $('chars').querySelectorAll('button').forEach(b=>b.disabled=true);
 $('checkBtn').hidden=true;$('resetBtn').hidden=true;$('nextBtn').hidden=false;
 updateButtons();record(row,correct);
}

function finish(){
 if(!running)return;
 running=false;void stopTracking(document.visibilityState==='visible'&&Date.now()-lastInteraction<=90000);
 show('result');
 const n=history.length,correct=history.filter(x=>x.correct).length;
 $('score').textContent=n?correct+' von '+n+' richtig · '+Math.round(100*correct/n)+' %':'Noch keine Aufgabe beantwortet.';
 $('repeatBtn').hidden=!history.some(x=>!x.correct);
 $('reviewList').replaceChildren();document.querySelector('.review').open=false;
 for(const item of history){
  const el=document.createElement('article'),prompt=document.createElement('strong'),attempt=document.createElement('p');
  prompt.textContent=item.row.de;
  attempt.className=item.correct?'good-text':'bad-text';attempt.lang='es';attempt.textContent=(item.correct?'✓ ':'✕ ')+item.entered;
  const original=document.createElement('p');original.lang='es';original.textContent='Fehlerhafter Satz: '+item.row.error.wrong;
  const solution=document.createElement('p');solution.lang='es';solution.className='good-text';solution.textContent='Richtiger Satz: '+item.row.es;
  el.append(prompt,original,attempt,solution);$('reviewList').append(el);
 }
}
$('selectAllBtn').onclick=()=>$('topics').querySelectorAll('input').forEach(el=>el.checked=true);
$('clearAllBtn').onclick=()=>$('topics').querySelectorAll('input').forEach(el=>el.checked=false);
$('startBtn').onclick=()=>begin(selection());$('finishBtn').onclick=finish;$('selectionBtn').onclick=()=>show('setup');$('againBtn').onclick=()=>begin(selection());$('repeatBtn').onclick=()=>begin(shuffle(history.filter(x=>!x.correct).map(x=>x.row)));
$('checkBtn').onclick=submit;$('resetBtn').onclick=()=>{if(locked)return;$('correctionInput').value='';updateButtons();$('correctionInput').focus()};$('nextBtn').onclick=()=>{if(!locked)return;if(++position===round.length)finish();else render()};
$('correctionInput').addEventListener('input',updateButtons);$('correctionInput').addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&!$('checkBtn').disabled){e.preventDefault();submit()}});
$('chars').querySelectorAll('button').forEach(button=>button.addEventListener('click',()=>{const el=$('correctionInput');if(locked||el.readOnly)return;el.setRangeText(button.dataset.char,el.selectionStart??el.value.length,el.selectionEnd??el.value.length,'end');el.focus();el.dispatchEvent(new Event('input',{bubbles:true}))}));
$('correctionInput').addEventListener('focus',()=>{$('chars').querySelectorAll('button').forEach(b=>b.disabled=locked)});
const paths=['grammatik-saetze-daten.json','grammatik-saetze-a2.json','grammatik-saetze-subjuntivo.json','grammatik-saetze-rest.json','grammatik-saetze-fehlerdaten.json','grammatik-saetze-varianten.json'];
Promise.all(paths.map(path=>fetch(path,{cache:'no-store'}).then(response=>{if(!response.ok)throw Error(path);return response.json()}))).then(all=>{
 const records=all.slice(0,4).flatMap(x=>x.sentences||[]),errorRows=all[4].exercises||[];alternatives=all[5].alternatives||{};const map=new Map(errorRows.map(r=>[r.id,r]));
 bank=records.map(row=>({...row,error:map.get(row.id)}));
 if(bank.length!==1300||errorRows.length!==1300||map.size!==1300||new Set(bank.map(x=>x.id)).size!==1300||bank.some(r=>!r.error||!r.de||!r.es||tokens(r.es).length!==tokens(r.error.wrong).length||tokens(r.error.wrong)[r.error.wordIndex]!==r.error.incorrectWord||tokens(r.es)[r.error.wordIndex]!==r.error.correctWord))throw Error('Ungültige Aufgaben');
 const groups=[...new Set(bank.map(r=>r.topic))];for(const topic of groups){const label=document.createElement('label');label.className='topic';const cb=document.createElement('input');cb.type='checkbox';cb.value=topic;cb.checked=topic==='Presente';label.append(cb,document.createTextNode(topic));$('topics').append(label)}
 $('startBtn').disabled=false;$('loadStatus').textContent='';
}).catch(()=>{$('loadStatus').textContent='Die Aufgaben konnten nicht geladen werden. Bitte lade die Seite erneut.';$('loadStatus').className='error'});
})();
