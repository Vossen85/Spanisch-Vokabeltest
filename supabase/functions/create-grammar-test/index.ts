
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
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
function subjImperfect(v:string){let [base,ref]=splitReflexive(v);const ellos=indef(base)[5],stem=ellos.slice(0,-3),sAcc=accentLastVowel(stem);const ra=[stem+"ra",stem+"ras",stem+"ra",sAcc+"ramos",stem+"rais",stem+"ran"],se=[stem+"se",stem+"ses",stem+"se",sAcc+"semos",stem+"seis",stem+"sen"];return addReflex(ra.map((x,i)=>x+" / "+se[i]),ref)}
const HABER:any={present:["he","has","ha","hemos","habéis","han"],imperfect:["había","habías","había","habíamos","habíais","habían"],subj:["haya","hayas","haya","hayamos","hayáis","hayan"],future:["habré","habrás","habrá","habremos","habréis","habrán"],conditional:["habría","habrías","habría","habríamos","habríais","habrían"]};
function compound(v:string,aux:string){let [base,ref]=splitReflexive(v),part=participle(base);return HABER[aux].map((h:string,i:number)=>(ref?REFL[i]+" ":"")+h+" "+part)}
function subjPluperfect(v:string){let [base,ref]=splitReflexive(v),part=participle(base),haber=subjImperfect("haber");return haber.map((h,i)=>(ref?REFL[i]+" ":"")+h.split(" / ")[0]+" "+part+" / "+h.split(" / ")[1]+" "+part)}
const FUT_ROOT:any={haber:"habr",caber:"cabr",poder:"podr",querer:"querr",saber:"sabr",poner:"pondr",tener:"tendr",valer:"valdr",venir:"vendr",salir:"saldr",decir:"dir",hacer:"har"};
function future(v:string){let [base,ref]=splitReflexive(v),r=FUT_ROOT[base]||base;return addReflex(["é","ás","á","emos","éis","án"].map(x=>r+x),ref)}
function conditional(v:string){let [base,ref]=splitReflexive(v),r=FUT_ROOT[base]||base;return addReflex(["ía","ías","ía","íamos","íais","ían"].map(x=>r+x),ref)}
const IMP_TU:any={decir:"di",hacer:"haz",ir:"ve",poner:"pon",salir:"sal",ser:"sé",tener:"ten",venir:"ven"};
function impTu(v:string){let [base,ref]=splitReflexive(v),f=IMP_TU[base]||present(base)[2];if(ref)f=f+"te";return [["du-Form","¡"+f+"!"]]}
function impVos(v:string){let [base,ref]=splitReflexive(v);if(ref){if(base==="ir")return [["ihr-Form","¡idos! / ¡iros!"]];return [["ihr-Form","¡"+base.slice(0,-1)+"os!"]]}return [["ihr-Form","¡"+base.slice(0,-1)+"d!"]]}
function impUsted(v:string){const s=subjPresent(v);return [["Höflichkeitsform Singular","¡"+s[2]+"!"],["Höflichkeitsform Plural","¡"+s[5]+"!"]]}
function impNeg(v:string){const s=subjPresent(v);return [["du-Form","¡no "+s[1]+"!"],["ihr-Form","¡no "+s[4]+"!"],["Höflichkeitsform Singular","¡no "+s[2]+"!"],["Höflichkeitsform Plural","¡no "+s[5]+"!"]]}
function formsFor(v:string,mode:string):[string,string][]{if(mode==="gerund"){const [base,isReflexive]=splitReflexive(v),g=gerund(base),estar=present("estar");return PERSONS.map((p,i)=>[p,(isReflexive?REFL[i]+" ":"")+estar[i]+" "+g] as [string,string])}if(mode==="present")return PERSONS.map((p,i)=>[p,present(v)[i]]);if(mode==="perfect")return PERSONS.map((p,i)=>[p,compound(v,"present")[i]]);if(mode==="indef")return PERSONS.map((p,i)=>[p,indef(v)[i]]);if(mode==="imperfect")return PERSONS.map((p,i)=>[p,imperfect(v)[i]]);if(mode==="pluperfect")return PERSONS.map((p,i)=>[p,compound(v,"imperfect")[i]]);if(mode==="subjPresent")return PERSONS.map((p,i)=>[p,subjPresent(v)[i]]);if(mode==="subjImperfect")return PERSONS.map((p,i)=>[p,subjImperfect(v)[i]]);if(mode==="subjPerfect")return PERSONS.map((p,i)=>[p,compound(v,"subj")[i]]);if(mode==="subjPluperfect")return PERSONS.map((p,i)=>[p,subjPluperfect(v)[i]]);if(mode==="impTu")return impTu(v) as [string,string][];if(mode==="impVos")return impVos(v) as [string,string][];if(mode==="impUsted")return impUsted(v) as [string,string][];if(mode==="impNeg")return impNeg(v) as [string,string][];if(mode==="future")return PERSONS.map((p,i)=>[p,future(v)[i]]);if(mode==="futurePerfect")return PERSONS.map((p,i)=>[p,compound(v,"future")[i]]);if(mode==="conditional")return PERSONS.map((p,i)=>[p,conditional(v)[i]]);if(mode==="conditionalPerfect")return PERSONS.map((p,i)=>[p,compound(v,"conditional")[i]]);return []}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const authHeader=req.headers.get("Authorization");
  if(!authHeader?.startsWith("Bearer "))return json({error:"Nicht angemeldet."},401);
  const url=Deno.env.get("SUPABASE_URL")!;
  const pub=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}").default||Deno.env.get("SUPABASE_ANON_KEY");
  const secret=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!pub||!secret)return json({error:"Serverkonfiguration unvollständig."},500);
  const userClient=createClient(url,pub,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});
  const admin=createClient(url,secret,{auth:{persistSession:false}});
  const token=authHeader.replace("Bearer ","");
  const {data:userData,error:userError}=await userClient.auth.getUser(token);
  if(userError||!userData.user)return json({error:"Anmeldung ungültig."},401);
  const {data:teacher,error:teacherError}=await admin.from("teacher_profiles").select("approved").eq("user_id",userData.user.id).maybeSingle();
  if(teacherError)throw teacherError;if(!teacher?.approved)return json({error:"Lehrerzugang ist noch nicht freigeschaltet."},403);

  const body=await req.json();
  const plan=Array.isArray(body?.plan)?body.plan:[];
  const vocabulary=body?.vocabulary&&typeof body.vocabulary==="object"?body.vocabulary:null;
  const combined=Boolean(vocabulary);
  const gradingMode=body?.gradingMode==="overall"?"overall":"separate";
  const durationMinutes=Number(body?.durationMinutes),testDate=String(body?.testDate||""),title=String(body?.title||"").trim();
  const courseId=String(body?.courseId||"").trim(),quarterNumber=Number(body?.quarterNumber);
  if(!courseId)return json({error:"Bitte einen Kurs auswählen."},400);
  if(!Number.isInteger(quarterNumber)||quarterNumber<1||quarterNumber>4)return json({error:"Bitte ein Quartal von 1 bis 4 auswählen."},400);
  const {data:course,error:courseError}=await admin.from("teacher_courses").select("id,name").eq("id",courseId).eq("owner_id",userData.user.id).eq("active",true).maybeSingle();
  if(courseError)throw courseError;
  if(!course)return json({error:"Der ausgewählte Kurs ist nicht verfügbar."},400);
  if(!plan.length||plan.length>100)return json({error:"Der Grammatiktest muss zwischen 1 und 100 Verb-Aufgaben enthalten."},400);
  let vocabCount=0,unitKeys:string[]=[],folderIds:number[]=[];
  if(combined){
    unitKeys=Array.isArray(vocabulary.unitKeys)?[...new Set(vocabulary.unitKeys.map((x:unknown)=>String(x).trim()).filter(Boolean))]:[];
    folderIds=Array.isArray(vocabulary.folderIds)?[...new Set(vocabulary.folderIds.map((x:unknown)=>Number(x)).filter((x:number)=>Number.isInteger(x)&&x>0))]:[];
    vocabCount=Number(vocabulary.questionCount);
    if(!unitKeys.length&&!folderIds.length)return json({error:"Bitte mindestens eine Unidad oder einen Unterordner für den Vokabelteil auswählen."},400);
    if(!Number.isInteger(vocabCount)||vocabCount<1||vocabCount>500)return json({error:"Die Anzahl der Vokabeln muss zwischen 1 und 500 liegen."},400);
  }
  if(!Number.isInteger(durationMinutes)||durationMinutes<1||durationMinutes>300)return json({error:"Die Bearbeitungszeit muss zwischen 1 und 300 Minuten liegen."},400);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(testDate))return json({error:"Bitte ein gültiges Testdatum wählen."},400);

  const questions:any[]=[];
  for(let i=0;i<plan.length;i++){
    const x=plan[i]||{},verb=String(x.verb||"").trim(),de=String(x.de||"").trim(),mode=String(x.mode||"").trim();
    const forms=formsFor(verb,mode);
    if(!verb||!de||!forms.length)return json({error:"Eine ausgewählte Grammatikaufgabe konnte nicht verarbeitet werden."},400);
    questions.push({
      position:i+1,source_snapshot:verb,accepted_answers_snapshot:[de,...forms.map(x=>x[1])],
      question_meta:{kind:"grammar",topicId:String(x.topicId||""),topicGroup:String(x.topicGroup||""),topicTitle:String(x.topicTitle||""),mode,verb,labels:forms.map(x=>x[0]),maxPoints:1+forms.length,...(combined?{gradingMode}:{})}
    });
  }
  let maxPoints=questions.reduce((s,q)=>s+Number(q.question_meta.maxPoints||0),0);
  for(let attempt=0;attempt<5;attempt++){
    const publicCode=randomCode(8);
    let combinedTestId:string|null=null,publicCodeForReturn=publicCode;
    let actualVocabCount=0;
    if(combined){
      const {data:testId,error:rpcError}=await admin.rpc("create_vocabulary_test_v2",{
        p_owner:userData.user.id,p_unit_keys:unitKeys,p_folder_ids:folderIds,p_question_count:vocabCount,
        p_test_date:testDate,p_duration_minutes:durationMinutes,p_title:title||"Gemischter Test",p_public_code:publicCode
      });
      if(rpcError){
        const msg=rpcError.message||"";
        if(msg.includes("NOT_ENOUGH_VOCAB:")){
          const available=Number(msg.split("NOT_ENOUGH_VOCAB:")[1]?.match(/\d+/)?.[0]||0);
          return json({error:`In der gewählten Auswahl stehen nur ${available} unterschiedliche Vokabelaufgaben zur Verfügung.`,available},400);
        }
        if(msg.toLowerCase().includes("duplicate")&&msg.toLowerCase().includes("public_code"))continue;
        throw rpcError;
      }
      combinedTestId=String(testId);publicCodeForReturn=publicCode;
      const {data:vocabRows,error:vocabError}=await admin.from("test_questions")
        .select("id,position,source_snapshot,accepted_answers_snapshot,question_meta")
        .eq("test_id",combinedTestId).order("position");
      if(vocabError){await admin.from("tests").delete().eq("id",combinedTestId);throw vocabError}
      actualVocabCount=(vocabRows||[]).length;
      if(!actualVocabCount){await admin.from("tests").delete().eq("id",combinedTestId);return json({error:"Der Vokabelteil enthält keine Aufgaben."},400)}
      for(const q of vocabRows||[]){
        const {error:metaError}=await admin.from("test_questions").update({question_meta:{...(q.question_meta||{}),kind:"vocab",gradingMode}}).eq("id",q.id);
        if(metaError){await admin.from("tests").delete().eq("id",combinedTestId);throw metaError}
      }
      for(let i=0;i<questions.length;i++)questions[i].position=actualVocabCount+i+1;
      const combinedMax=actualVocabCount+maxPoints;
      const {error:updateError}=await admin.from("tests").update({
        test_type:"combined",course_id:courseId,quarter_number:quarterNumber,question_count:actualVocabCount+questions.length,
        title:title||"Gemischter Test"
      }).eq("id",combinedTestId).eq("owner_id",userData.user.id);
      if(updateError){await admin.from("tests").delete().eq("id",combinedTestId);throw updateError}
      const grammarRows=questions.map(q=>({...q,test_id:combinedTestId,vocabulary_id:null}));
      const {error:insertGrammarError}=await admin.from("test_questions").insert(grammarRows);
      if(insertGrammarError){await admin.from("tests").delete().eq("id",combinedTestId);throw insertGrammarError}
      return json({ok:true,testId:combinedTestId,publicCode:publicCodeForReturn,title:title||"Gemischter Test",testDate,questionCount:actualVocabCount+questions.length,
        vocabularyCount:actualVocabCount,grammarCount:questions.length,durationMinutes,maxPoints:combinedMax,courseId,courseName:course.name,quarterNumber,gradingMode});
    }
    const {data:test,error:testError}=await admin.from("tests").insert({
      owner_id:userData.user.id,public_code:publicCode,title:title||"Grammatiktest",test_date:testDate,
      question_count:questions.length,duration_minutes:durationMinutes,status:"open",test_type:"grammar",
      course_id:courseId,quarter_number:quarterNumber
    }).select("id,public_code,title,test_date,question_count,duration_minutes").single();
    if(testError){
      const msg=String(testError.message||"").toLowerCase();
      if(msg.includes("duplicate")&&msg.includes("public_code"))continue;
      throw testError;
    }
    const rows=questions.map(q=>({...q,test_id:test.id,vocabulary_id:null}));
    const {error:qError}=await admin.from("test_questions").insert(rows);
    if(qError){await admin.from("tests").delete().eq("id",test.id);throw qError}
    return json({ok:true,testId:test.id,publicCode:test.public_code,title:test.title,testDate:test.test_date,questionCount:test.question_count,durationMinutes:test.duration_minutes,maxPoints,courseId,courseName:course.name,quarterNumber});
  }
  return json({error:"Es konnte kein eindeutiger Testcode erzeugt werden. Bitte erneut versuchen."},500);
 }catch(err){console.error(err);return json({error:"Der Grammatiktest konnte nicht erstellt werden."},500)}
});
