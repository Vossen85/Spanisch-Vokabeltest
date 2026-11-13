/* ¡Avanza! Wörterbuch-Suchindex. Ausschließlich übergebene Vokabel- und Grammatikdaten. */
(function(global){
"use strict";
const fold=s=>String(s??"").replace(/[ñÑ]/g,"\uE000").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("de").replace(/\uE000/g,"ñ").replace(/[¿¡]/g,"").trim().replace(/\s+/g," ");
const tokens=s=>fold(s).match(/[a-zäöüßñ]+/g)||[];
const unique=a=>[...new Set(a.filter(Boolean))];
const pretStems={tener:"tuv",estar:"estuv",andar:"anduv",poder:"pud",poner:"pus",saber:"sup",caber:"cup",haber:"hub",hacer:"hic",querer:"quis",venir:"vin",decir:"dij",traer:"traj",conducir:"conduj",traducir:"traduj",producir:"produj",introducir:"introduj",mantener:"mantuv",obtener:"obtuv"};
const futStems={tener:"tendr",venir:"vendr",poner:"pondr",salir:"saldr",valer:"valdr",poder:"podr",saber:"sabr",querer:"querr",haber:"habr",hacer:"har",decir:"dir",mantener:"mantendr",obtener:"obtendr"};
const part={escribir:"escrito",describir:"descrito",hacer:"hecho",ver:"visto",decir:"dicho",poner:"puesto",volver:"vuelto",devolver:"devuelto",abrir:"abierto",cubrir:"cubierto",descubrir:"descubierto",morir:"muerto",romper:"roto",resolver:"resuelto",imprimir:"impreso"};
const presIrreg={
 ser:"soy eres es somos sois son",ir:"voy vas va vamos vais van",estar:"estoy estas esta estamos estais estan",
 haber:"he has ha hemos habeis han hay",dar:"doy das da damos dais dan",ver:"veo ves ve vemos veis ven",
 oir:"oigo oyes oye oimos ois oyen",tener:"tengo tienes tiene tenemos teneis tienen",
 venir:"vengo vienes viene venimos venis vienen",hacer:"hago haces hace hacemos haceis hacen",
 decir:"digo dices dice decimos decis dicen",poner:"pongo pones pone ponemos poneis ponen",
 salir:"salgo sales sale salimos salis salen",saber:"se sabes sabe sabemos sabeis saben",
 caber:"quepo cabes cabe cabemos cabeis caben",traer:"traigo traes trae traemos traeis traen",
 conocer:"conozco conoces conoce conocemos conoceis conocen",
 conducir:"conduzco conduces conduce conducimos conducis conducen",
 traducir:"traduzco traduces traduce traducimos traducis traducen",
 producir:"produzco produces produce producimos producis producen",
 jugar:"juego juegas juega jugamos jugais juegan"
};
const pretIrreg={
 ser:"fui fuiste fue fuimos fuisteis fueron",ir:"fui fuiste fue fuimos fuisteis fueron",
 dar:"di diste dio dimos disteis dieron",ver:"vi viste vio vimos visteis vieron",
 leer:"lei leiste leyo leimos leisteis leyeron",oir:"oi oiste oyo oimos oisteis oyeron",
 caer:"cai caiste cayo caimos caisteis cayeron",creer:"crei creiste creyo creimos creisteis creyeron"
};
const impIrreg={ser:"era eras era eramos erais eran",ir:"iba ibas iba ibamos ibais iban",ver:"veia veias veia veiamos veiais veian"};
const shifts={
 "ie":new Set("pensar entender querer cerrar empezar comenzar sentir preferir perder despertar mentir calentar recomendar defender encender negar gobernar acertar".split(" ")),
 "ue":new Set("dormir volver contar encontrar poder morir recordar demostrar mostrar costar sonar oler mover devolver volar probar resolver almorzar jugar".split(" ")),
 "i":new Set("pedir servir repetir elegir seguir conseguir medir vestir competir corregir reir sonreir".split(" "))
};
const shortVerbs=new Set(["ir","ser","ver","dar","oir","reir"]);
function infinitives(es){
 const w=tokens(es),lemmas=[];
 for(let i=0;i<w.length;i++){
  const v=w[i];
  if(!/(ar|er|ir)(se)?$/.test(v)&&!shortVerbs.has(v))continue;
  if(v.length<4&&!shortVerbs.has(v))continue;
  if(["lugar","mar","azar","azucar","hogar","placer","ayer","cualquier"].includes(v))continue;
  if(i&&["el","la","los","las","un","una","unos","unas"].includes(w[i-1]))continue;
  lemmas.push(v);
 }
 return unique(lemmas);
}
function conjugations(lemma){
 const result=new Map(), add=(v,kind)=>{v=fold(v);if(v&&!result.has(v))result.set(v,kind)};
 const l=fold(lemma).replace(/se$/,"");if(!/(ar|er|ir)$/.test(l))return result;
 const e=l.slice(-2),stem=l.slice(0,-2),ar=e==="ar",er=e==="er";
 const batch=(root,endings,kind)=>endings.forEach(s=>add(root+s,kind));
 const prs=ar?["o","as","a","amos","ais","an"]:er?["o","es","e","emos","eis","en"]:["o","es","e","imos","is","en"];
 if(!presIrreg[l])batch(stem,prs,"Presente");
 if(!pretIrreg[l]&&!pretStems[l])batch(stem,ar?["e","aste","o","amos","asteis","aron"]:["i","iste","io","imos","isteis","ieron"],"Pretérito indefinido");
 if(!impIrreg[l])batch(stem,ar?["aba","abas","aba","abamos","abais","aban"]:["ia","ias","ia","iamos","iais","ian"],"Pretérito imperfecto");
 batch(stem,ar?["e","es","e","emos","eis","en"]:["a","as","a","amos","ais","an"],"Subjuntivo presente");
 batch(stem,ar?["ara","aras","ara","aramos","arais","aran"]:["iera","ieras","iera","ieramos","ierais","ieran"],"Subjuntivo imperfecto");
 batch(l,["e","as","a","emos","eis","an"],"Futuro simple");
 batch(l,["ia","ias","ia","iamos","iais","ian"],"Condicional simple");
 add(stem+(ar?"ando":"iendo"),"Gerundio");
 add(stem+(ar?"ado":"ido"),"Participio");
 if(part[l])add(part[l],"unregelmäßiges Participio");
 for(const [map,label] of [[presIrreg,"unregelmäßiges Presente"],[pretIrreg,"unregelmäßiges Pretérito indefinido"],[impIrreg,"Pretérito imperfecto"]]){
  if(map[l])map[l].split(" ").forEach(v=>add(v,label));
 }
 if(pretStems[l]){
  const p=pretStems[l];
  batch(p,l==="hacer"?["e","iste","imos","isteis","ieron"]:["e","iste","o","imos","isteis",p.endsWith("j")?"eron":"ieron"],"unregelmäßiges Pretérito indefinido");
  if(l==="hacer")add("hizo","Pretérito indefinido");
 }
 if(futStems[l]){
  batch(futStems[l],["e","as","a","emos","eis","an"],"unregelmäßiges Futuro");
  batch(futStems[l],["ia","ias","ia","iamos","iais","ian"],"unregelmäßiges Condicional");
 }
 for(const [target,set] of Object.entries(shifts)){
  if(!set.has(l))continue;
  const from=target==="ue"?"o":"e",pos=stem.lastIndexOf(from);
  if(pos<0)continue;
  const changed=stem.slice(0,pos)+target+stem.slice(pos+1);
  [0,1,2,5].forEach(i=>add(changed+prs[i],"Stammwechsel im Präsens"));
  if(e==="ir"){
   const pp=stem.slice(0,pos)+(target==="ue"?"u":"i")+stem.slice(pos+1);
   add(pp+"io","Stammwechsel im Pretérito indefinido");
   add(pp+"ieron","Stammwechsel im Pretérito indefinido");
  }
 }
 if(ar&&stem.endsWith("c"))add(stem.slice(0,-1)+"que","Pretérito indefinido");
 if(ar&&stem.endsWith("g"))add(stem+"ue","Pretérito indefinido");
 if(ar&&stem.endsWith("z"))add(stem.slice(0,-1)+"ce","Pretérito indefinido");
 return result;
}
function singular(q){
 const c=new Set(),parts=tokens(q);
 if(parts.length===2&&["los","las","unos","unas"].includes(parts[0]))q=parts[1];
 else if(parts.length!==1)return c;
 if(q.endsWith("ces")&&q.length>4)c.add(q.slice(0,-3)+"z");
 if(q.endsWith("es")&&q.length>4)c.add(q.slice(0,-2));
 if(q.endsWith("s")&&q.length>3)c.add(q.slice(0,-1));
 return c;
}
function build(raw){
 const entries=(raw||[]).map((e,index)=>{
  const spanish=unique((Array.isArray(e.spanish)?e.spanish:[e.spanish]).map(x=>String(x||"").trim()));
  const german=String(e.german||"").trim();
  return {index,spanish,german,type:e.type||"Vokabeln",locations:e.locations||[],
    needles:unique([...spanish,german].map(fold)),lemmas:unique(spanish.flatMap(infinitives))};
 }).filter(e=>e.spanish.length&&e.german);
 const allLemmas=new Set(entries.flatMap(e=>e.lemmas)),forms=new Map();
 for(const lemma of allLemmas){
  for(const [form,reason] of conjugations(lemma)){
   if(!forms.has(form))forms.set(form,new Map());
   forms.get(form).set(lemma,reason);
  }
 }
 function lookup(search,max=40){
  const q=fold(search);if(q.length<2)return {results:[],total:0};
  const morph=forms.get(q)||new Map(),sing=singular(q),results=[];
  for(const e of entries){
   let rank=99,reason="";
   for(const v of e.needles){
    if(v===q)rank=Math.min(rank,0);
    else if(tokens(v).includes(q))rank=Math.min(rank,1);
    else if(v.startsWith(q)||tokens(v).some(t=>t.startsWith(q)))rank=Math.min(rank,2);
    else if(v.includes(q))rank=Math.min(rank,3);
   }
   // Eine erkannte flektierte Form ist genauer als ein zufälliger Wortanfang:
   // "compré" → comprar muss vor "comprender" erscheinen.
   // Nur ein vollständiger Wörterbucheintrag (Rang 0) hat Vorrang.
   if(rank>0){
    const lemma=e.lemmas.find(v=>morph.has(v));
    if(lemma){
     rank=0.5;
     let formInfo=morph.get(lemma);
     if(/é$/i.test(String(search).trim())&&lemma.replace(/se$/,"").endsWith("ar")&&formInfo==="Pretérito indefinido"){
      formInfo+=" · yo-Form";
     }
     reason="Erkannte Verbform von "+lemma+" · "+formInfo;
    }else{
     for(const form of sing)if(e.spanish.some(v=>tokens(v).includes(form))){
      if(rank>0.75){rank=0.75;reason="Mögliche Singularform: "+form;}
      break;
     }
    }
   }
   if(rank<99)results.push({...e,rank,reason});
  }
  results.sort((a,b)=>a.rank-b.rank||fold(a.spanish[0]).localeCompare(fold(b.spanish[0]),"de")||a.type.localeCompare(b.type));
  return {results:results.slice(0,max),total:results.length};
 }
 return {lookup,totalEntries:entries.length,verbs:allLemmas.size};
}
global.AvanzaWoerterbuchSuche={build,fold};
})(window);
