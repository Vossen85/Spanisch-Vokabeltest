import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}
function getAdmin(){
  const url=Deno.env.get("SUPABASE_URL")!;
  const secret=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!secret)throw new Error("Server configuration missing");
  return createClient(url,secret,{auth:{persistSession:false}});
}
const PERSONS=["yo","tú","él / ella / usted","nosotros / nosotras","vosotros / vosotras","ellos / ellas / ustedes"];
const REFL=["me","te","se","nos","os","se"];
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}
function randomCode(length=8){const a="ABCDEFGHJKLMNPQRSTUVWXYZ23456789",b=new Uint8Array(length);crypto.getRandomValues(b);return Array.from(b,x=>a[x%a.length]).join("")}
function splitReflexive(v:string){return v.endsWith("se")?[v.slice(0,-2),true] as const:[v,false] as const}
function changeLast(s:string,from:string,to:string){const i=s.lastIndexOf(from);return i<0?s:s.slice(0,i)+to+s.slice(i+from.length)}
function accentLastVowel(s:string){for(let i=s.length-1;i>=0;i--){const m:any={a:"á",e:"é",i:"í",o:"ó",u:"ú"}[s[i]];if(m)return s.slice(0,i)+m+s.slice(i+1)}return s}
function addReflex(forms:string[],isRef:boolean){return isRef?forms.map((f,i)=>REFL[i]+" "+f):forms}
const EIE=new Set(["cerrar","querer","preferir","comenzar","despertar","empezar","encender","entender","mentir","nevar","pensar","recomendar","sentar","sentir"]);
const OUE=new Set(["probar","poder","dormir","contar","doler","encontrar","morir","mostrar","mover","oler","llover","sonar","soñar","volver","acordar","acostar","almorzar"]);
const UUE=new Set(["jugar"]);
const EI=new Set(["pedir","reír","seguir","corregir","despedir","elegir","impedir","medir","repetir","servir","vestir","regir"]);
const CZC=new Set(["conocer","ofrecer","conducir","agradecer","crecer","nacer","obedecer","permanecer","pertenecer","reconocer","producir","traducir"]);
const GJ=new Set(["coger","dirigir","mugir","proteger","restringir","corregir","elegir","regir"]);
const CZ=new Set(["vencer","convencer"]);
const UIR=new Set(["huir","concluir","construir","destruir","disminuir"]);
const PRESENT_EXACT:any={
ser:["soy","eres","es","somos","sois","son"],estar:["estoy","estás","está","estamos","estáis","están"],
ir:["voy","vas","va","vamos","vais","van"],dar:["doy","das","da","damos","dais","dan"],
decir:["digo","dices","dice","decimos","decís","dicen"],ver:["veo","ves","ve","vemos","veis","ven"],
oír:["oigo","oyes","oye","oímos","oís","oyen"],tener:["tengo","tienes","tiene","tenemos","tenéis","tienen"],
hacer:["hago","haces","hace","hacemos","hacéis","hacen"],poner:["pongo","pones","pone","ponemos","ponéis","ponen"],
traer:["traigo","traes","trae","traemos","traéis","traen"],saber:["sé","sabes","sabe","sabemos","sabéis","saben"],
venir:["vengo","vienes","viene","venimos","venís","vienen"],salir:["salgo","sales","sale","salimos","salís","salen"],
caer:["caigo","caes","cae","caemos","caéis","caen"],reír:["río","ríes","ríe","reímos","reís","ríen"],
seguir:["sigo","sigues","sigue","seguimos","seguís","siguen"],oler:["huelo","hueles","huele","olemos","oléis","huelen"]
};
function present(v:string){
  let [base,ref]=splitReflexive(v);
  if(PRESENT_EXACT[base])return addReflex([...PRESENT_EXACT[base]],ref);
  const cls=base.endsWith("ar")?"ar":base.endsWith("er")?"er":"ir";
  const endings=cls==="ar"?["o","as","a","amos","áis","an"]:cls==="er"?["o","es","e","emos","éis","en"]:["o","es","e","imos","ís","en"];
  let root=base.slice(0,-2),forms:string[]=[];
  for(let i=0;i<6;i++){let r=root;
    if(i===0||i===1||i===2||i===5){if(EIE.has(base))r=changeLast(r,"e","ie");if(OUE.has(base))r=changeLast(r,"o","ue");if(UUE.has(base))r=changeLast(r,"u","ue");if(EI.has(base))r=changeLast(r,"e","i")}
    if(UIR.has(base)&&(i===0||i===1||i===2||i===5)){forms.push(i===0?r+"yo":r+"y"+endings[i]);continue}
    if(i===0){if(CZC.has(base)){forms.push(base.slice(0,-3)+"zco");continue}if(GJ.has(base))r=r.slice(0,-1)+"j";else if(CZ.has(base))r=r.slice(0,-1)+"z"}
    forms.push(r+endings[i]);
  } return addReflex(forms,ref);
}
const GER_EXACT:any={caer:"cayendo",decir:"diciendo",dormir:"durmiendo",leer:"leyendo",ir:"yendo",morir:"muriendo",oír:"oyendo",poder:"pudiendo",ser:"siendo",traer:"trayendo",venir:"viniendo",ver:"viendo",sentir:"sintiendo",seguir:"siguiendo",construir:"construyendo",destruir:"destruyendo"};
function gerund(v:string){let [base]=splitReflexive(v);return GER_EXACT[base]||base.slice(0,-2)+(base.endsWith("ar")?"ando":"iendo")}
const PART:any={abrir:"abierto",cubrir:"cubierto",decir:"dicho",escribir:"escrito",hacer:"hecho",ir:"ido",morir:"muerto",poner:"puesto",romper:"roto",ser:"sido",ver:"visto",volver:"vuelto",describir:"descrito",revolver:"revuelto"};
function participle(v:string){let [base]=splitReflexive(v);return PART[base]||base.slice(0,-2)+(base.endsWith("ar")?"ado":"ido")}
const INDEF_EXACT:any={
ser:["fui","fuiste","fue","fuimos","fuisteis","fueron"],ir:["fui","fuiste","fue","fuimos","fuisteis","fueron"],
dar:["di","diste","dio","dimos","disteis","dieron"],ver:["vi","viste","vio","vimos","visteis","vieron"],
creer:["creí","creíste","creyó","creímos","creísteis","creyeron"],caer:["caí","caíste","cayó","caímos","caísteis","cayeron"],
construir:["construí","construiste","construyó","construimos","construisteis","construyeron"],huir:["huí","huiste","huyó","huimos","huisteis","huyeron"],
leer:["leí","leíste","leyó","leímos","leísteis","leyeron"],oír:["oí","oíste","oyó","oímos","oísteis","oyeron"],reír:["reí","reíste","rió","reímos","reísteis","rieron"]
};
const IRREG_ROOT:any={estar:"estuv",tener:"tuv",poder:"pud",poner:"pus",hacer:"hic",venir:"vin",querer:"quis",saber:"sup",andar:"anduv",decir:"dij",traer:"traj",traducir:"traduj",producir:"produj",conducir:"conduj",haber:"hub",reducir:"reduj",seducir:"seduj",caber:"cup"};
function indef(v:string){
  let [base,ref]=splitReflexive(v),forms:string[];
  if(INDEF_EXACT[base])forms=[...INDEF_EXACT[base]];
  else if(IRREG_ROOT[base]){const r=IRREG_ROOT[base],j=r.endsWith("j");forms=[r+"e",r+"iste",base==="hacer"?"hizo":r+"o",r+"imos",r+"isteis",r+(j?"eron":"ieron")]}
  else{const cls=base.endsWith("ar")?"ar":base.endsWith("er")?"er":"ir";const endings=cls==="ar"?["é","aste","ó","amos","asteis","aron"]:["í","iste","ió","imos","isteis","ieron"];let root=base.slice(0,-2);
    forms=endings.map((e,i)=>{let r=root;if(cls==="ir"&&(i===2||i===5)){if(EIE.has(base)||EI.has(base))r=changeLast(r,"e","i");if(OUE.has(base))r=changeLast(r,"o","u")}
      if(i===0&&cls==="ar"){if(base.endsWith("gar"))r=r.slice(0,-1)+"gu";else if(base.endsWith("car"))r=r.slice(0,-1)+"qu";else if(base.endsWith("zar"))r=r.slice(0,-1)+"c"}return r+e})}
  return addReflex(forms,ref);
}
function imperfect(v:string){let [base,ref]=splitReflexive(v),forms:string[];if(base==="ser")forms=["era","eras","era","éramos","erais","eran"];else if(base==="ir")forms=["iba","ibas","iba","íbamos","ibais","iban"];else if(base==="ver")forms=["veía","veías","veía","veíamos","veíais","veían"];else{const root=base.slice(0,-2);forms=(base.endsWith("ar")?["aba","abas","aba","ábamos","abais","aban"]:["ía","ías","ía","íamos","íais","ían"]).map(x=>root+x)}return addReflex(forms,ref)}
const SUBJ_FULL:any={dar:["dé","des","dé","demos","deis","den"],estar:["esté","estés","esté","estemos","estéis","estén"],haber:["haya","hayas","haya","hayamos","hayáis","hayan"],ir:["vaya","vayas","vaya","vayamos","vayáis","vayan"],saber:["sepa","sepas","sepa","sepamos","sepáis","sepan"],ser:["sea","seas","sea","seamos","seáis","sean"],caber:["quepa","quepas","quepa","quepamos","quepáis","quepan"]};
const SUBJ_STEM:any={hacer:"hag",tener:"teng",salir:"salg",caer:"caig",decir:"dig",oír:"oig",poner:"pong",traer:"traig",venir:"veng",valer:"valg",conducir:"conduzc",ofrecer:"ofrezc",construir:"construy",ver:"ve"};
function subjPresent(v:string){let [base,ref]=splitReflexive(v);if(SUBJ_FULL[base])return addReflex([...SUBJ_FULL[base]],ref);const cls=base.endsWith("ar")?"ar":base.endsWith("er")?"er":"ir",endings=cls==="ar"?["e","es","e","emos","éis","en"]:["a","as","a","amos","áis","an"],forms:string[]=[];
 for(let i=0;i<6;i++){let r=base.slice(0,-2);if(SUBJ_STEM[base])r=SUBJ_STEM[base];else if(cls==="ir"&&EIE.has(base))r=changeLast(r,"e",(i===3||i===4)?"i":"ie");else if(cls==="ir"&&OUE.has(base))r=changeLast(r,"o",(i===3||i===4)?"u":"ue");else if(EI.has(base))r=changeLast(r,"e","i");else if((i===0||i===1||i===2||i===5)&&EIE.has(base))r=changeLast(r,"e","ie");else if((i===0||i===1||i===2||i===5)&&OUE.has(base))r=changeLast(r,"o","ue");else if((i===0||i===1||i===2||i===5)&&UUE.has(base))r=changeLast(r,"u","ue");
  if(!SUBJ_STEM[base]){if(base.endsWith("car"))r=r.slice(0,-1)+"qu";else if(base.endsWith("gar"))r=r.slice(0,-1)+"gu";else if(base.endsWith("guar"))r=r.slice(0,-2)+"gü";else if(base.endsWith("ger")||base.endsWith("gir"))r=r.slice(0,-1)+"j";else if(base.endsWith("guir"))r=r.slice(0,-2)+"g";else if(CZC.has(base))r=base.slice(0,-3)+"zc";else if(CZ.has(base))r=r.slice(0,-1)+"z";else if(base.endsWith("zar"))r=r.slice(0,-1)+"c";if(UIR.has(base))r=base.slice(0,-2)+"y"}forms.push(r+endings[i])}return addReflex(forms,ref)}
function subjImperfect(v:string){let [base,ref]=splitReflexive(v);const ellos=indef(base)[5],stem=ellos.slice(0,-3),sAcc=accentLastVowel(stem);return addReflex([stem+"ra",stem+"ras",stem+"ra",sAcc+"ramos",stem+"rais",stem+"ran"],ref)}
const HABER:any={present:["he","has","ha","hemos","habéis","han"],imperfect:["había","habías","había","habíamos","habíais","habían"],subj:["haya","hayas","haya","hayamos","hayáis","hayan"],future:["habré","habrás","habrá","habremos","habréis","habrán"],conditional:["habría","habrías","habría","habríamos","habríais","habrían"]};
function compound(v:string,aux:string){let [base,ref]=splitReflexive(v),part=participle(base);return HABER[aux].map((h:string,i:number)=>(ref?REFL[i]+" ":"")+h+" "+part)}
function subjPluperfect(v:string){let [base,ref]=splitReflexive(v),part=participle(base),haber=subjImperfect("haber");return haber.map((h,i)=>(ref?REFL[i]+" ":"")+h+" "+part)}
const FUT_ROOT:any={haber:"habr",caber:"cabr",poder:"podr",querer:"querr",saber:"sabr",poner:"pondr",tener:"tendr",valer:"valdr",venir:"vendr",salir:"saldr",decir:"dir",hacer:"har"};
function future(v:string){let [base,ref]=splitReflexive(v),r=FUT_ROOT[base]||base;return addReflex(["é","ás","á","emos","éis","án"].map(x=>r+x),ref)}
function conditional(v:string){let [base,ref]=splitReflexive(v),r=FUT_ROOT[base]||base;return addReflex(["ía","ías","ía","íamos","íais","ían"].map(x=>r+x),ref)}
const IMP_TU:any={decir:"di",hacer:"haz",ir:"ve",poner:"pon",salir:"sal",ser:"sé",tener:"ten",venir:"ven"};
function impTu(v:string){let [base,ref]=splitReflexive(v),f=IMP_TU[base]||present(base)[2];if(ref)f=f+"te";return [["du-Form","¡"+f+"!"]]}
function impVos(v:string){let [base,ref]=splitReflexive(v);if(ref){if(base==="ir")return [["ihr-Form","¡idos! / ¡iros!"]];return [["ihr-Form","¡"+base.slice(0,-1)+"os!"]]}return [["ihr-Form","¡"+base.slice(0,-1)+"d!"]]}
function impUsted(v:string){const s=subjPresent(v);return [["Höflichkeitsform Singular","¡"+s[2]+"!"],["Höflichkeitsform Plural","¡"+s[5]+"!"]]}
function impNeg(v:string){const s=subjPresent(v);return [["du-Form","¡no "+s[1]+"!"],["ihr-Form","¡no "+s[4]+"!"],["Höflichkeitsform Singular","¡no "+s[2]+"!"],["Höflichkeitsform Plural","¡no "+s[5]+"!"]]}
function formsFor(v:string,mode:string):[string,string][]{if(mode==="gerund")return [["Gerundio",gerund(v)]];if(mode==="present")return PERSONS.map((p,i)=>[p,present(v)[i]]);if(mode==="perfect")return PERSONS.map((p,i)=>[p,compound(v,"present")[i]]);if(mode==="indef")return PERSONS.map((p,i)=>[p,indef(v)[i]]);if(mode==="imperfect")return PERSONS.map((p,i)=>[p,imperfect(v)[i]]);if(mode==="pluperfect")return PERSONS.map((p,i)=>[p,compound(v,"imperfect")[i]]);if(mode==="subjPresent")return PERSONS.map((p,i)=>[p,subjPresent(v)[i]]);if(mode==="subjImperfect")return PERSONS.map((p,i)=>[p,subjImperfect(v)[i]]);if(mode==="subjPerfect")return PERSONS.map((p,i)=>[p,compound(v,"subj")[i]]);if(mode==="subjPluperfect")return PERSONS.map((p,i)=>[p,subjPluperfect(v)[i]]);if(mode==="impTu")return impTu(v) as [string,string][];if(mode==="impVos")return impVos(v) as [string,string][];if(mode==="impUsted")return impUsted(v) as [string,string][];if(mode==="impNeg")return impNeg(v) as [string,string][];if(mode==="future")return PERSONS.map((p,i)=>[p,future(v)[i]]);if(mode==="futurePerfect")return PERSONS.map((p,i)=>[p,compound(v,"future")[i]]);if(mode==="conditional")return PERSONS.map((p,i)=>[p,conditional(v)[i]]);if(mode==="conditionalPerfect")return PERSONS.map((p,i)=>[p,compound(v,"conditional")[i]]);return []}


function normalize(s:unknown){
 return String(s??"").normalize("NFC").trim()
 .replace(/[(){}\[\],]/g," ")
 .replace(/^[¿¡!"'“”‘’\s]+|[?!.,!"'“”‘’\s]+$/g,"")
 .replace(/\s+/g," ").trim();
}
function comparisonKey(s:unknown){return normalize(s).replace(/\s+/g,"")}
function accentCaseFold(s:string){return s.replace(/[áÁ]/g,m=>m==="Á"?"A":"a").replace(/[éÉ]/g,m=>m==="É"?"E":"e").replace(/[íÍ]/g,m=>m==="Í"?"I":"i").replace(/[óÓ]/g,m=>m==="Ó"?"O":"o").replace(/[úÚ]/g,m=>m==="Ú"?"U":"u").replace(/[üÜ]/g,m=>m==="Ü"?"U":"u").toLocaleLowerCase("es")}
function variants(expected:string){return expected.split(/\s*\/\s*/).map(normalize).filter(Boolean)}
function scoreField(typed:string,expected:string){
 const t=comparisonKey(typed);if(!t)return 0;
 const vs=variants(expected).map(comparisonKey);
 if(vs.includes(t))return 1;
 const ft=accentCaseFold(t);
 for(const v of vs)if(accentCaseFold(v)===ft)return .5;
 return 0;
}
function pointsForPercent(p:number){if(p>=95)return 15;if(p>=90)return 14;if(p>=85)return 13;if(p>=80)return 12;if(p>=75)return 11;if(p>=70)return 10;if(p>=65)return 9;if(p>=60)return 8;if(p>=55)return 7;if(p>=50)return 6;if(p>=45)return 5;if(p>=39)return 4;if(p>=33)return 3;if(p>=27)return 2;if(p>=20)return 1;return 0}
function gradeForPoints(p:number){return ["6","5-","5","5+","4-","4","4+","3-","3","3+","2-","2","2+","1-","1","1+"][p]||"6"}


async function getSession(admin:any,token:string){
  const {data,error}=await admin.from("practice_sessions").select("*").eq("access_token",token).maybeSingle();
  if(error)throw error;return data;
}
async function getQuestions(admin:any,sessionId:string,includeAnswers=false){
  const sel=includeAnswers
    ?"id,position,source_snapshot,accepted_answers_snapshot,question_meta"
    :"id,position,source_snapshot,question_meta";
  const {data,error}=await admin.from("practice_questions").select(sel).eq("session_id",sessionId).order("position");
  if(error)throw error;return data||[];
}
async function saveAnswers(admin:any,session:any,incoming:any[]){
  if(!Array.isArray(incoming))return;
  const qs=await getQuestions(admin,session.id,false),valid=new Set(qs.map((q:any)=>String(q.id))),rows:any[]=[];
  for(const a of incoming){
    const id=String(a?.questionId??"");
    if(!valid.has(id))continue;
    const payload={
      translation:String(a?.translation??"").slice(0,300),
      forms:Array.isArray(a?.forms)?a.forms.map((x:any)=>String(x??"").slice(0,300)).slice(0,10):[]
    };
    rows.push({session_id:session.id,question_id:id,response_text:JSON.stringify(payload),updated_at:new Date().toISOString()});
  }
  if(rows.length){
    const {error}=await admin.from("practice_answers").upsert(rows,{onConflict:"session_id,question_id"});
    if(error)throw error;
  }
}
async function finalize(admin:any,session:any){
  if(session.status==="submitted")return;
  const qs=await getQuestions(admin,session.id,true);
  const {data:ars,error}=await admin.from("practice_answers").select("question_id,response_text").eq("session_id",session.id);
  if(error)throw error;
  const map=new Map((ars||[]).map((a:any)=>[String(a.question_id),a.response_text||""]));
  let total=0,max=0;const rows:any[]=[];
  for(const q of qs as any[]){
    const expected=(q.accepted_answers_snapshot||[]).map(String);
    max+=expected.length;
    let payload:any={translation:"",forms:[]};
    try{payload=JSON.parse(map.get(String(q.id))||"{}")}catch{}
    let pts=scoreField(String(payload.translation||""),expected[0]||"");
    for(let i=1;i<expected.length;i++)pts+=scoreField(String(payload.forms?.[i-1]||""),expected[i]);
    total+=pts;
    rows.push({
      session_id:session.id,question_id:q.id,
      response_text:JSON.stringify({translation:String(payload.translation||""),forms:Array.isArray(payload.forms)?payload.forms:[]}),
      points:pts,updated_at:new Date().toISOString()
    });
  }
  if(rows.length){
    const {error:e}=await admin.from("practice_answers").upsert(rows,{onConflict:"session_id,question_id"});
    if(e)throw e;
  }
  const percent=max?Math.round(total/max*1000)/10:0,op=pointsForPercent(percent),grade=gradeForPoints(op);
  const {error:u}=await admin.from("practice_sessions").update({
    status:"submitted",submitted_at:new Date().toISOString(),raw_points:total,max_points:max,
    percent,grade_text:grade,upper_school_points:op
  }).eq("id",session.id);
  if(u)throw u;
}
async function buildResult(admin:any,session:any){
  const {data:f,error}=await admin.from("practice_sessions").select("*").eq("id",session.id).single();
  if(error)throw error;
  const qs=await getQuestions(admin,f.id,true);
  const {data:ars,error:ae}=await admin.from("practice_answers").select("question_id,response_text,points").eq("session_id",f.id);
  if(ae)throw ae;
  const map=new Map((ars||[]).map((a:any)=>[String(a.question_id),a]));
  return {
    accessToken:String(f.access_token||""),
    submittedAt:f.submitted_at,
    config:{
      topicIds:f.grammar_topic_ids||[],
      questionCount:f.question_count,
      durationMinutes:f.duration_minutes
    },
    summary:{
      rawPoints:Number(f.raw_points||0),maxPoints:Number(f.max_points||0),percent:Number(f.percent||0),
      gradeText:f.grade_text||"—",upperSchoolPoints:Number(f.upper_school_points||0)
    },
    corrections:(qs as any[]).map((q:any)=>{
      const a:any=map.get(String(q.id))||{};
      let p:any={translation:"",forms:[]};try{p=JSON.parse(a.response_text||"{}")}catch{}
      const ex=q.accepted_answers_snapshot||[];
      const translationPoint=scoreField(String(p.translation||""),String(ex[0]||""));
      const formPoints=ex.slice(1).map((expected:any,i:number)=>scoreField(String(p.forms?.[i]||""),String(expected||"")));
      return {
        position:q.position,sourceText:q.source_snapshot,topicGroup:q.question_meta?.topicGroup||"",
        topicTitle:q.question_meta?.topicTitle||"",mode:q.question_meta?.mode||"",labels:q.question_meta?.labels||[],
        translation:p.translation||"",forms:p.forms||[],expectedTranslation:ex[0]||"",expectedForms:ex.slice(1),
        translationPoint,formPoints,points:Number(a.points||0),maxPoints:ex.length
      };
    })
  };
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return response({error:"Method not allowed"},405);
  try{
    const admin=getAdmin(),body=await req.json(),action=String(body?.action||"");

    if(action==="start"){
      const plan=Array.isArray(body?.plan)?body.plan:[];
      const topicIds=Array.isArray(body?.topicIds)?[...new Set(body.topicIds.map((x:any)=>String(x).trim()).filter(Boolean))]:[];
      const durationMinutes=Number(body?.durationMinutes);
      if(!plan.length||plan.length>100)return response({error:"Der Grammatiktest muss zwischen 1 und 100 Verb-Aufgaben enthalten."},400);
      if(!Number.isInteger(durationMinutes)||durationMinutes<1||durationMinutes>300)return response({error:"Die Zeit muss zwischen 1 und 300 Minuten liegen."},400);

      const questions:any[]=[];
      for(let i=0;i<plan.length;i++){
        const x=plan[i]||{},verb=String(x.verb||"").trim(),de=String(x.de||"").trim(),mode=String(x.mode||"").trim();
        const forms=formsFor(verb,mode);
        if(!verb||!de||!forms.length)return response({error:"Eine ausgewählte Grammatikaufgabe konnte nicht verarbeitet werden."},400);
        questions.push({
          position:i+1,source_snapshot:verb,accepted_answers_snapshot:[de,...forms.map(x=>x[1])],
          question_meta:{
            kind:"grammar",topicId:String(x.topicId||""),topicGroup:String(x.topicGroup||""),
            topicTitle:String(x.topicTitle||""),mode,verb,labels:forms.map(x=>x[0]),maxPoints:1+forms.length
          }
        });
      }
      const maxPoints=questions.reduce((s,q)=>s+Number(q.question_meta.maxPoints||0),0);
      const deadline=new Date(Date.now()+durationMinutes*60000).toISOString();
      const {data:session,error:se}=await admin.from("practice_sessions").insert({
        deadline_at:deadline,duration_minutes:durationMinutes,question_count:questions.length,
        unit_keys:[],folder_ids:[],practice_type:"grammar",grammar_topic_ids:topicIds,max_points:maxPoints
      }).select("id,access_token,deadline_at").single();
      if(se)throw se;
      const rows=questions.map(q=>({...q,session_id:session.id,vocabulary_id:null}));
      const {data:inserted,error:qe}=await admin.from("practice_questions").insert(rows).select("id,position,source_snapshot,question_meta");
      if(qe){await admin.from("practice_sessions").delete().eq("id",session.id);throw qe}
      return response({
        ok:true,accessToken:session.access_token,deadlineAt:session.deadline_at,
        config:{topicIds,questionCount:questions.length,durationMinutes},
        questions:(inserted||[]).sort((a:any,b:any)=>a.position-b.position),savedAnswers:[]
      });
    }

    if(action==="session"){
      const token=String(body?.accessToken||"").trim();
      if(!token)return response({error:"Sitzung fehlt."},401);
      const session=await getSession(admin,token);
      if(!session||session.practice_type!=="grammar")return response({error:"Sitzung nicht gefunden."},404);
      if(session.status==="submitted")return response({ok:true,submitted:true,result:await buildResult(admin,session)});
      if(Date.now()>=new Date(session.deadline_at).getTime()){
        await finalize(admin,session);
        return response({ok:true,submitted:true,expired:true,result:await buildResult(admin,session)});
      }
      const qs=await getQuestions(admin,session.id,false);
      const {data:saved,error:sv}=await admin.from("practice_answers").select("question_id,response_text").eq("session_id",session.id);
      if(sv)throw sv;
      return response({
        ok:true,accessToken:token,deadlineAt:session.deadline_at,
        config:{topicIds:session.grammar_topic_ids||[],questionCount:session.question_count,durationMinutes:session.duration_minutes},
        questions:qs,savedAnswers:saved||[]
      });
    }

    if(action==="save"||action==="submit"){
      const token=String(body?.accessToken||"").trim(),session=await getSession(admin,token);
      if(!session||session.practice_type!=="grammar")return response({error:"Sitzung nicht gefunden."},404);
      if(session.status==="submitted")return response({ok:true,submitted:true,result:await buildResult(admin,session)});
      await saveAnswers(admin,session,body?.answers||[]);
      const expired=Date.now()>=new Date(session.deadline_at).getTime();
      if(action==="submit"||expired){
        await finalize(admin,session);
        return response({ok:true,submitted:true,expired,result:await buildResult(admin,session)});
      }
      return response({ok:true,savedAt:new Date().toISOString()});
    }

    return response({error:"Unbekannte Aktion."},400);
  }catch(err){
    console.error(err);
    return response({error:"Die Grammatik-Testsimulation konnte gerade nicht verarbeitet werden."},500);
  }
});