
import { createClient } from "npm:@supabase/supabase-js@2";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS"};
function response(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}})}
function getAdmin(){const url=Deno.env.get("SUPABASE_URL")!;const secret=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}").default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");if(!url||!secret)throw new Error("Server configuration missing");return createClient(url,secret,{auth:{persistSession:false}})}
function normalize(s:unknown){return String(s??"").normalize("NFC").trim().replace(/[(){}\[\]]/g," ").replace(/^[¿¡!"'“”‘’\s]+|[?!.,!"'“”‘’\s]+$/g,"").replace(/\s+/g," ").trim()}
function accentCaseFold(s:string){return s.replace(/[áÁ]/g,m=>m==="Á"?"A":"a").replace(/[éÉ]/g,m=>m==="É"?"E":"e").replace(/[íÍ]/g,m=>m==="Í"?"I":"i").replace(/[óÓ]/g,m=>m==="Ó"?"O":"o").replace(/[úÚ]/g,m=>m==="Ú"?"U":"u").replace(/[üÜ]/g,m=>m==="Ü"?"U":"u").toLocaleLowerCase("es")}
function variants(expected:string){return expected.split(/\s*\/\s*/).map(normalize).filter(Boolean)}
function scoreField(typed:string,expected:string){const t=normalize(typed);if(!t)return 0;const vs=variants(expected);if(vs.includes(t))return 1;const ft=accentCaseFold(t);for(const v of vs)if(accentCaseFold(v)===ft)return .5;return 0}
function pointsForPercent(p:number){if(p>=95)return 15;if(p>=90)return 14;if(p>=85)return 13;if(p>=80)return 12;if(p>=75)return 11;if(p>=70)return 10;if(p>=65)return 9;if(p>=60)return 8;if(p>=55)return 7;if(p>=50)return 6;if(p>=45)return 5;if(p>=39)return 4;if(p>=33)return 3;if(p>=27)return 2;if(p>=20)return 1;return 0}
function gradeForPoints(p:number){return ["6","5-","5","5+","4-","4","4+","3-","3","3+","2-","2","2+","1-","1","1+"][p]||"6"}
async function getTestByCode(admin:any,code:string){const {data,error}=await admin.from("tests").select("id,public_code,title,test_date,question_count,duration_minutes,status,test_type,course_id,quarter_number").eq("public_code",code).maybeSingle();if(error)throw error;return data}

async function courseNameForTest(admin:any,t:any){if(!t.course_id)return "";const {data,error}=await admin.from("teacher_courses").select("name").eq("id",t.course_id).maybeSingle();if(error)throw error;return data?.name||""}
async function studentForTest(admin:any,t:any,studentCode:string){if(!t.course_id)return {userId:null,error:null};const {data,error}=await admin.from("course_students").select("user_id").eq("course_id",t.course_id).eq("student_number",Number(studentCode)).eq("active",true).maybeSingle();if(error)throw error;if(!data)return {userId:null,error:"Diese Schülernummer ist im zugeordneten Kurs nicht vergeben. Bitte prüfe die Nummer."};return {userId:data.user_id,error:null}}
async function getSubmission(admin:any,token:string){const {data,error}=await admin.from("submissions").select("id,test_id,student_code,started_at,deadline_at,submitted_at,status,access_token").eq("access_token",token).maybeSingle();if(error)throw error;return data}
async function getQuestions(admin:any,testId:string,answers=false){const sel=answers?"id,position,source_snapshot,accepted_answers_snapshot,question_meta":"id,position,source_snapshot,question_meta";const {data,error}=await admin.from("test_questions").select(sel).eq("test_id",testId).order("position");if(error)throw error;return data||[]}
async function saveAnswers(admin:any,sub:any,incoming:any[]){if(!Array.isArray(incoming))return;const qs=await getQuestions(admin,sub.test_id,false),valid=new Set(qs.map((q:any)=>String(q.id))),rows:any[]=[];for(const a of incoming){const id=String(a?.questionId??"");if(!valid.has(id))continue;const payload={translation:String(a?.translation??"").slice(0,300),forms:Array.isArray(a?.forms)?a.forms.map((x:any)=>String(x??"").slice(0,300)).slice(0,10):[]};rows.push({submission_id:sub.id,question_id:id,response_text:JSON.stringify(payload),updated_at:new Date().toISOString()})}if(rows.length){const {error}=await admin.from("answers").upsert(rows,{onConflict:"submission_id,question_id"});if(error)throw error}}
async function finalize(admin:any,sub:any,autoSubmitted:boolean){
 if(sub.status==="submitted")return;
 const qs=await getQuestions(admin,sub.test_id,true);
 const {data:ars,error}=await admin.from("answers").select("question_id,response_text").eq("submission_id",sub.id);if(error)throw error;
 const map=new Map((ars||[]).map((a:any)=>[String(a.question_id),a.response_text||""]));
 let total=0,max=0,vocabPoints=0,vocabMax=0,grammarPoints=0,grammarMax=0;const rows:any[]=[];
 for(const q of qs as any[]){
   const expected=(q.accepted_answers_snapshot||[]).map(String);
   let payload:any={translation:"",forms:[]};try{payload=JSON.parse(map.get(String(q.id))||"{}")}catch{}
   const isVocab=q.question_meta?.kind==="vocab";
   let pts=0,questionMax=0;
   if(isVocab){
     questionMax=1;
     pts=Math.max(0,...expected.map((answer:string)=>scoreField(String(payload.translation||""),answer)));
     vocabPoints+=pts;vocabMax+=questionMax;
   }else{
     questionMax=expected.length;
     pts=scoreField(String(payload.translation||""),expected[0]||"");
     for(let i=1;i<expected.length;i++)pts+=scoreField(String(payload.forms?.[i-1]||""),expected[i]);
     grammarPoints+=pts;grammarMax+=questionMax;
   }
   total+=pts;max+=questionMax;
   rows.push({submission_id:sub.id,question_id:q.id,response_text:JSON.stringify({translation:String(payload.translation||""),forms:Array.isArray(payload.forms)?payload.forms:[]}),auto_correct:pts===questionMax,auto_points:pts,updated_at:new Date().toISOString()});
 }
 if(rows.length){const {error:e}=await admin.from("answers").upsert(rows,{onConflict:"submission_id,question_id"});if(e)throw e}
 const percent=max?Math.round(total/max*1000)/10:0,op=pointsForPercent(percent),grade=gradeForPoints(op);
 const vocabGrade=gradeForPoints(pointsForPercent(vocabMax?Math.round(vocabPoints/vocabMax*1000)/10:0));
 const grammarGrade=gradeForPoints(pointsForPercent(grammarMax?Math.round(grammarPoints/grammarMax*1000)/10:0));
 const combinedMode=(qs as any[]).find((q:any)=>q.question_meta?.gradingMode)?.question_meta?.gradingMode;
 const gradeText=combinedMode==="separate"?`Vokabeln: ${vocabGrade} · Grammatik: ${grammarGrade}`:grade;
 const {error:u}=await admin.from("submissions").update({status:"submitted",submitted_at:new Date().toISOString(),auto_submitted:autoSubmitted,raw_points:total,max_points:max,percent,grade_text:gradeText,upper_school_points:op}).eq("id",sub.id);if(u)throw u
}
async function result(admin:any,sub:any){
 const {data:f,error}=await admin.from("submissions").select("id,test_id,student_code,submitted_at,raw_points,max_points,percent,grade_text,upper_school_points,status").eq("id",sub.id).single();if(error)throw error;
 const {data:test,error:te}=await admin.from("tests").select("title,test_date,question_count,duration_minutes").eq("id",f.test_id).single();if(te)throw te;
 const qs=await getQuestions(admin,f.test_id,true);const {data:ars,error:ae}=await admin.from("answers").select("question_id,response_text,auto_points,teacher_points,teacher_adjustments").eq("submission_id",f.id);if(ae)throw ae;
 const map=new Map((ars||[]).map((a:any)=>[String(a.question_id),a]));
 const stats={vocab:{points:0,max:0},grammar:{points:0,max:0}};
 for(const q of qs as any[]){
   const a:any=map.get(String(q.id))||{},m=q.question_meta||{},expected=(q.accepted_answers_snapshot||[]).map(String);
   const payload:any=(()=>{try{return JSON.parse(a.response_text||"{}")}catch{return {translation:"",forms:[]}}})();
   const isVocab=m.kind==="vocab",key=isVocab?"vocab":"grammar",partMax=isVocab?1:expected.length;
   let partPoints=Number(a.teacher_points??a.auto_points??0);
   const adjustments=a.teacher_adjustments&&typeof a.teacher_adjustments==="object"&&!Array.isArray(a.teacher_adjustments)?a.teacher_adjustments:{};
   if(Object.keys(adjustments).length){
     const scores=isVocab?[Math.max(0,...expected.map((x:string)=>scoreField(String(payload.translation||""),x)))]:[
       scoreField(String(payload.translation||""),expected[0]||""),...expected.slice(1).map((x:string,i:number)=>scoreField(String(payload.forms?.[i]||""),x))
     ];
     partPoints=scores.reduce((sum:number,pt:number,index:number)=>sum+(Object.prototype.hasOwnProperty.call(adjustments,String(index))?Number(adjustments[String(index)]):pt),0);
   }
   stats[key].points+=partPoints;stats[key].max+=partMax;
 }
 const gradeBreakdown={vocabulary:{points:stats.vocab.points,maxPoints:stats.vocab.max,percent:stats.vocab.max?Math.round(stats.vocab.points/stats.vocab.max*1000)/10:0,grade:gradeForPoints(pointsForPercent(stats.vocab.max?stats.vocab.points/stats.vocab.max*100:0))},grammar:{points:stats.grammar.points,maxPoints:stats.grammar.max,percent:stats.grammar.max?Math.round(stats.grammar.points/stats.grammar.max*1000)/10:0,grade:gradeForPoints(pointsForPercent(stats.grammar.max?stats.grammar.points/stats.grammar.max*100:0))}};
 return {accessToken:String(sub.access_token||""),studentCode:f.student_code,submittedAt:f.submitted_at,test:{title:test.title||"Grammatiktest",testDate:test.test_date,questionCount:test.question_count,durationMinutes:test.duration_minutes},summary:{rawPoints:Number(f.raw_points||0),maxPoints:Number(f.max_points||0),percent:Number(f.percent||0),gradeText:f.grade_text||"—",upperSchoolPoints:Number(f.upper_school_points||0),gradeBreakdown},corrections:(qs as any[]).map((q:any)=>{
   const a:any=map.get(String(q.id))||{};
   let p:any={translation:"",forms:[]};try{p=JSON.parse(a.response_text||"{}")}catch{}
   const ex=q.accepted_answers_snapshot||[];
   const isVocab=q.question_meta?.kind==="vocab";
   const autoParts=isVocab
     ? [Math.max(0,...ex.map((expected:any)=>scoreField(String(p.translation||""),String(expected||""))))]
     : [scoreField(String(p.translation||""),String(ex[0]||"")),...ex.slice(1).map((expected:any,i:number)=>scoreField(String(p.forms?.[i]||""),String(expected||"")))];
   const adjustments=(a.teacher_adjustments&&typeof a.teacher_adjustments==="object"&&!Array.isArray(a.teacher_adjustments))?a.teacher_adjustments:{};
   const effectiveParts=autoParts.map((pt:number,i:number)=>Object.prototype.hasOwnProperty.call(adjustments,String(i))?Number(adjustments[String(i)]):pt);
   const hasAdjustments=Object.keys(adjustments).length>0;
   const effectiveTotal=hasAdjustments?effectiveParts.reduce((s:number,pt:number)=>s+Number(pt||0),0):Number(a.teacher_points??a.auto_points??0);
   return {
     position:q.position,sourceText:q.source_snapshot,questionKind:q.question_meta?.kind||"grammar",topicGroup:q.question_meta?.topicGroup||"",topicTitle:q.question_meta?.topicTitle||"",
     mode:q.question_meta?.mode||"",labels:q.question_meta?.labels||[],translation:p.translation||"",forms:p.forms||[],
     expectedTranslation:isVocab?ex.join(" / "):(ex[0]||""),expectedForms:isVocab?[]:ex.slice(1),
     translationPoint:Number(effectiveParts[0]||0),formPoints:effectiveParts.slice(1),
     translationAdjusted:Object.prototype.hasOwnProperty.call(adjustments,"0"),
     formAdjusted:isVocab?[]:ex.slice(1).map((_:any,i:number)=>Object.prototype.hasOwnProperty.call(adjustments,String(i+1))),
     points:effectiveTotal,maxPoints:isVocab?1:ex.length
   };
 })};
}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
 if(req.method!=="POST")return response({error:"Method not allowed"},405);
 try{
  const admin=getAdmin(),body=await req.json(),action=String(body?.action||""),code=String(body?.code||"").trim().toUpperCase();
  if(action==="info"){if(!code)return response({error:"Testcode fehlt."},400);const t=await getTestByCode(admin,code);if(!t||t.status!=="open"||!["grammar","combined"].includes(t.test_type))return response({error:"Dieser Test ist nicht verfügbar."},404);return response({ok:true,test:{title:t.title||"Grammatiktest",testDate:t.test_date,questionCount:t.question_count,durationMinutes:t.duration_minutes,testType:t.test_type,courseName:await courseNameForTest(admin,t),quarterNumber:t.quarter_number}})}
  if(action==="start"){
    if(!code)return response({error:"Testcode fehlt."},400);const studentCode=String(body?.studentCode||"").trim();if(!/^\d{1,12}$/.test(studentCode))return response({error:"Bitte deine persönliche Schülernummer eingeben."},400);
    const t=await getTestByCode(admin,code);if(!t||t.status!=="open"||!["grammar","combined"].includes(t.test_type))return response({error:"Dieser Test ist nicht verfügbar."},404);
    const account=await studentForTest(admin,t,studentCode);if(account.error)return response({error:account.error},400);const studentUserId=account.userId;
    const {data:existing,error:ee}=await admin.from("submissions").select("id,test_id,student_code,deadline_at,submitted_at,status,access_token").eq("test_id",t.id).eq("student_code",studentCode).maybeSingle();if(ee)throw ee;
    const supplied=String(body?.accessToken||"").trim();
    if(existing){
      if(existing.status==="submitted"){if(!supplied||supplied!==String(existing.access_token))return response({error:"Mit dieser Schülernummer wurde der Test bereits abgegeben."},409);return response({ok:true,submitted:true,result:await result(admin,existing)})}
      if(!supplied||supplied!==String(existing.access_token))return response({error:"Mit dieser Schülernummer wurde der Test bereits gestartet."},409);
      const qs=await getQuestions(admin,t.id,false),{data:saved}=await admin.from("answers").select("question_id,response_text").eq("submission_id",existing.id);
      return response({ok:true,resumed:true,accessToken:existing.access_token,studentCode,deadlineAt:existing.deadline_at,test:{title:t.title||"Grammatiktest",testDate:t.test_date,questionCount:t.question_count,durationMinutes:t.duration_minutes,courseName:await courseNameForTest(admin,t),quarterNumber:t.quarter_number},questions:qs,savedAnswers:saved||[]});
    }
    const qs=await getQuestions(admin,t.id,true),max=qs.reduce((sum:number,q:any)=>sum+(q.question_meta?.kind==="vocab"?1:(q.accepted_answers_snapshot?.length||0)),0),deadline=new Date(Date.now()+Number(t.duration_minutes)*60000).toISOString();
    const {data:sub,error:se}=await admin.from("submissions").insert({test_id:t.id,student_code:studentCode,student_user_id:studentUserId,deadline_at:deadline,max_points:max}).select("id,access_token,deadline_at").single();if(se)throw se;
    return response({ok:true,resumed:false,accessToken:sub.access_token,studentCode,deadlineAt:sub.deadline_at,test:{title:t.title||"Grammatiktest",testDate:t.test_date,questionCount:t.question_count,durationMinutes:t.duration_minutes,courseName:await courseNameForTest(admin,t),quarterNumber:t.quarter_number},questions:qs.map((q:any)=>({id:q.id,position:q.position,source_snapshot:q.source_snapshot,question_meta:q.question_meta})),savedAnswers:[]});
  }
  if(action==="session"){
    const token=String(body?.accessToken||"").trim();const sub=await getSubmission(admin,token);if(!sub)return response({error:"Sitzung nicht gefunden."},404);if(sub.status==="submitted")return response({ok:true,submitted:true,result:await result(admin,sub)});
    if(Date.now()>=new Date(sub.deadline_at).getTime()){await finalize(admin,sub,true);return response({ok:true,submitted:true,expired:true,result:await result(admin,sub)})}
    const {data:t,error:te}=await admin.from("tests").select("title,test_date,question_count,duration_minutes,test_type").eq("id",sub.test_id).single();if(te)throw te;if(!["grammar","combined"].includes(t.test_type))return response({error:"Falscher Testtyp."},400);
    const qs=await getQuestions(admin,sub.test_id,false),{data:saved}=await admin.from("answers").select("question_id,response_text").eq("submission_id",sub.id);
    return response({ok:true,accessToken:token,studentCode:sub.student_code,deadlineAt:sub.deadline_at,test:{title:t.title||"Grammatiktest",testDate:t.test_date,questionCount:t.question_count,durationMinutes:t.duration_minutes,courseName:await courseNameForTest(admin,t),quarterNumber:t.quarter_number},questions:qs,savedAnswers:saved||[]});
  }
  if(action==="save"||action==="submit"){
    const token=String(body?.accessToken||"").trim(),sub=await getSubmission(admin,token);if(!sub)return response({error:"Sitzung nicht gefunden."},404);if(sub.status==="submitted")return response({ok:true,submitted:true,result:await result(admin,sub)});
    await saveAnswers(admin,sub,body?.answers||[]);const expired=Date.now()>=new Date(sub.deadline_at).getTime();
    if(action==="submit"||expired){await finalize(admin,sub,Boolean(body?.auto)||expired);return response({ok:true,submitted:true,expired,result:await result(admin,sub)})}
    return response({ok:true,savedAt:new Date().toISOString()});
  }
  return response({error:"Unbekannte Aktion."},400);
 }catch(err){console.error(err);return response({error:"Der Grammatiktest konnte gerade nicht verarbeitet werden."},500)}
});
