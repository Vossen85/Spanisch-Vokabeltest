(()=>{
'use strict';
const $=id=>document.getElementById(id);
const query=new URLSearchParams(location.search);
const personalized=query.get('personalisiert')==='1';
const back='grammatik-saetze.html'+(personalized?'?personalisiert=1':'');
$('homeLink').href=back;$('backLink').href=back;
const client=window.supabase?.createClient('https://jzolxrqrrljwpmjbdxmo.supabase.co','sb_publishable_AGUrdmy8nEQZJlPfgd9qbw_J6xkojrj',{auth:{storageKey:'avanza-student-auth-token',persistSession:true,autoRefreshToken:true}});
if(client)window.avanzaStudentClient=client;
const seenKey='avanza-sentence-order-seen-v1';
let bank=[],alternatives={},round=[],position=0,history=[],running=false,locked=false;
let pieces=[],mixed=[],selected=[],loggedIn=false,sessionId=null,lastInteraction=Date.now();
let trackingQueue=Promise.resolve();
const shuffle=arr=>{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
const tokens=sentence=>(String(sentence||'').normalize('NFC').match(/[\p{L}\p{M}\p{N}]+/gu)||[]).map(x=>x.toLocaleLowerCase('es-ES'));
const signature=words=>words.join('\u001f');
function scrambled(list){let out=shuffle(list);if(out.length>1&&signature(out.map(x=>x.word))===signature(list.map(x=>x.word))){const j=out.findIndex((x,i)=>i>0&&x.word!==out[0].word);if(j>0)[out[0],out[j]]=[out[j],out[0]]}return out}
function show(page){for(const id of ['setup','exercise','result'])$(id).hidden=id!==page;window.scrollTo({top:0,behavior:'instant'})}
function note(){lastInteraction=Date.now()}
['pointerdown','keydown'].forEach(type=>document.addEventListener(type,note,{passive:true}));
async function invoke(name,body){const {data,error}=await client.functions.invoke(name,{body});if(error||data?.error)throw Error(data?.error||error.message);return data}
function enqueue(job){trackingQueue=trackingQueue.then(job).catch(()=>{$('saveStatus').textContent='Lernzeit oder Ergebnis konnte gerade nicht gespeichert werden.'});return trackingQueue}
function startTracking(){return enqueue(async()=>{if(!client||!running||document.visibilityState!=='visible'||sessionId)return;const {data}=await client.auth.getSession();loggedIn=!!data?.session;if(!loggedIn){$('saveStatus').textContent='Ohne Anmeldung wird dein Lernfortschritt nicht gespeichert.';return}const res=await invoke('learning-activity',{action:'start',activityType:'grammar',mode:'extra',groupKey:'Satzübungen · Wörter ordnen'});sessionId=res.sessionId})}
function stopTracking(active){return enqueue(async()=>{if(!sessionId)return;const id=sessionId;sessionId=null;await invoke('learning-activity',{action:'end',sessionId:id,active})})}
setInterval(()=>{if(!running||document.visibilityState!=='visible')return;if(Date.now()-lastInteraction>90000){void stopTracking(false);return}if(!sessionId){void startTracking();return}void enqueue(async()=>{if(sessionId)await invoke('learning-activity',{action:'ping',sessionId})})},30000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void stopTracking(false);else if(running){note();void startTracking()}});
window.addEventListener('pagehide',()=>{running=false;void stopTracking(false)});
function record(row,correct){if(!client)return;void enqueue(async()=>{if(!loggedIn)return;await invoke('student-progress',{action:'record',itemType:'grammar',groupKey:'Satzbausteine · '+row.topic,itemKey:'sentence-order:'+row.id,itemLabel:row.de,correct,sessionId:sessionId||undefined});$('saveStatus').textContent='Lernfortschritt gespeichert.'})}
function selectedTopics(){return [...$('topics').querySelectorAll('input:checked')].map(el=>el.value)}
function selection(){const topics=selectedTopics();if(!topics.length){$('loadStatus').textContent='Bitte wähle mindestens ein Grammatikthema.';return null}const eligible=bank.filter(row=>topics.includes(row.topic)),amount=$('amount').value;const n=amount==='all'?eligible.length:Math.min(Number(amount),eligible.length);let seen=[];try{seen=JSON.parse(localStorage.getItem(seenKey)||'[]');if(!Array.isArray(seen))seen=[]}catch{}const old=new Set(seen);const fresh=shuffle(eligible.filter(row=>!old.has(row.id))),review=shuffle(eligible.filter(row=>old.has(row.id)));return fresh.concat(review).slice(0,n)}
function remember(row){try{let items=JSON.parse(localStorage.getItem(seenKey)||'[]');if(!Array.isArray(items))items=[];const set=new Set(items);const topicRows=bank.filter(x=>x.topic===row.topic);if(topicRows.every(x=>set.has(x.id)))for(const x of topicRows)set.delete(x.id);set.add(row.id);localStorage.setItem(seenKey,JSON.stringify([...set]))}catch{}}
function begin(rows){if(!rows?.length)return;round=rows;position=0;history=[];running=true;locked=false;$('saveStatus').textContent='';note();show('exercise');void startTracking();render()}
function makeButton(text,css,label,onclick){const b=document.createElement('button');b.type='button';b.className=css;b.lang='es';b.textContent=text;if(label)b.setAttribute('aria-label',label);b.disabled=locked;b.addEventListener('click',onclick);return b}
function renderBuilder(){const slots=$('slots'),wordBank=$('wordBank');slots.replaceChildren();wordBank.replaceChildren();const used=new Set(selected);
for(let i=0;i<pieces.length;i++){
 if(i<selected.length){const token=pieces[selected[i]];slots.append(makeButton(token.word,'slot filled',`Wort ${i+1}: ${token.word} – zurücknehmen`,()=>{selected.splice(i,1);renderBuilder()}))}
 else{const placeholder=document.createElement('span');placeholder.className='slot';placeholder.textContent=String(i+1);placeholder.setAttribute('aria-label',`Platz ${i+1} noch leer`);slots.append(placeholder)}
}
for(const token of mixed){if(used.has(token.id))continue;wordBank.append(makeButton(token.word,'word',token.word+' einsetzen',()=>{selected.push(token.id);renderBuilder()}))}
$('checkBtn').disabled=locked||selected.length!==pieces.length;
$('resetBtn').disabled=locked||selected.length===0;
}
function render(){const row=round[position];locked=false;selected=[];const words=tokens(row.es);pieces=words.map((word,id)=>({id,word}));mixed=scrambled(pieces);$('topicHeading').textContent=row.topic;$('phenomenon').textContent=row.phen||'';$('position').textContent='Aufgabe '+(position+1)+' von '+round.length;$('correctCount').textContent=history.filter(x=>x.correct).length+' richtig';$('progress').value=history.length;$('progress').max=round.length;$('prompt').textContent=row.de;$('feedback').textContent='';$('feedback').className='feedback';$('checkBtn').hidden=false;$('resetBtn').hidden=false;$('nextBtn').hidden=true;$('nextBtn').textContent=position===round.length-1?'Ergebnisse ansehen':'Weiter';renderBuilder();$('topicHeading').focus({preventScroll:true})}
function submit(){if(!running||locked||selected.length!==pieces.length)return;locked=true;const row=round[position],order=selected.map(id=>pieces[id].word),attempt=signature(order),answer=signature(tokens(row.es)),others=(alternatives[row.id]||[]).map(s=>signature(tokens(s))),correct=attempt===answer||others.includes(attempt);history.push({row,correct,answer:order.join(' ')});remember(row);$('progress').value=history.length;$('correctCount').textContent=history.filter(x=>x.correct).length+' richtig';$('feedback').className='feedback '+(correct?'good':'bad');$('feedback').textContent=correct?(attempt===answer?'✓ Richtig!':'✓ Richtig! Diese Satzstellung ist ebenfalls möglich.'):'✕ Die Reihenfolge stimmt noch nicht. Richtiger Satz: '+row.es;$('checkBtn').hidden=true;$('resetBtn').hidden=true;$('nextBtn').hidden=false;renderBuilder();record(row,correct)}
function finish(){if(!running)return;running=false;void stopTracking(document.visibilityState==='visible'&&Date.now()-lastInteraction<=90000);show('result');const n=history.length,correct=history.filter(x=>x.correct).length;$('score').textContent=n?correct+' von '+n+' richtig · '+Math.round(100*correct/n)+' %':'Noch keine Aufgabe beantwortet.';$('repeatBtn').hidden=!history.some(x=>!x.correct);$('reviewList').replaceChildren();document.querySelector('.review').open=false;
for(const item of history){const block=document.createElement('article'),question=document.createElement('strong'),given=document.createElement('p');question.textContent=item.row.de;given.lang='es';given.className=item.correct?'good-text':'bad-text';given.textContent=(item.correct?'✓ ':'✕ ')+item.answer;block.append(question,given);if(!item.correct){const right=document.createElement('p');right.lang='es';right.className='good-text';right.textContent='✓ '+item.row.es;block.append(right)}$('reviewList').append(block)}}
$('selectAllBtn').onclick=()=>$('topics').querySelectorAll('input').forEach(el=>el.checked=true);
$('clearAllBtn').onclick=()=>$('topics').querySelectorAll('input').forEach(el=>el.checked=false);
$('startBtn').onclick=()=>begin(selection());$('finishBtn').onclick=finish;$('selectionBtn').onclick=()=>show('setup');$('againBtn').onclick=()=>begin(selection());$('repeatBtn').onclick=()=>begin(shuffle(history.filter(x=>!x.correct).map(x=>x.row)));
$('checkBtn').onclick=submit;$('resetBtn').onclick=()=>{if(locked)return;selected=[];renderBuilder()};$('nextBtn').onclick=()=>{if(!locked)return;if(++position===round.length)finish();else render()};
const paths=['grammatik-saetze-daten.json','grammatik-saetze-a2.json','grammatik-saetze-subjuntivo.json','grammatik-saetze-rest.json','grammatik-saetze-varianten.json'];
Promise.all(paths.map(path=>fetch(path,{cache:'no-store'}).then(response=>{if(!response.ok)throw Error(path);return response.json()}))).then(all=>{
 bank=all.slice(0,4).flatMap(x=>x.sentences||[]);alternatives=all[4].alternatives||{};
 if(bank.length!==1300||new Set(bank.map(x=>x.id)).size!==1300||bank.some(x=>!x.id||!x.de||!x.es||tokens(x.es).length<2))throw Error('Ungültige Satzdatenbank');
 const groups=[...new Set(bank.map(r=>r.topic))];for(const topic of groups){const label=document.createElement('label');label.className='topic';const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.value=topic;checkbox.checked=topic==='Presente';label.append(checkbox,document.createTextNode(topic));$('topics').append(label)}
 $('startBtn').disabled=false;$('loadStatus').textContent='';
}).catch(()=>{$('loadStatus').textContent='Die Satzübungen konnten nicht geladen werden. Bitte lade die Seite erneut.';$('loadStatus').className='error'});
})();
