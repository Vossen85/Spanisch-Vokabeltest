
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function pointsForPercent(p: number) {
  if (p >= 95) return 15; if (p >= 90) return 14; if (p >= 85) return 13; if (p >= 80) return 12;
  if (p >= 75) return 11; if (p >= 70) return 10; if (p >= 65) return 9; if (p >= 60) return 8;
  if (p >= 55) return 7; if (p >= 50) return 6; if (p >= 45) return 5; if (p >= 39) return 4;
  if (p >= 33) return 3; if (p >= 27) return 2; if (p >= 20) return 1; return 0;
}
function gradeForPoints(p: number) {
  return ["6","5-","5","5+","4-","4","4+","3-","3","3+","2-","2","2+","1-","1","1+"][p] || "6";
}
function normalize(s: unknown) {
  return String(s ?? "").normalize("NFC").trim()
    .replace(/[(){}\[\]]/g, " ")
    .replace(/^[¿¡!"'“”‘’\s]+|[?!.,!"'“”‘’\s]+$/g, "")
    .replace(/\s+/g, " ").trim();
}
function accentCaseFold(s: string) {
  return s.replace(/[áÁ]/g,m=>m==="Á"?"A":"a").replace(/[éÉ]/g,m=>m==="É"?"E":"e")
    .replace(/[íÍ]/g,m=>m==="Í"?"I":"i").replace(/[óÓ]/g,m=>m==="Ó"?"O":"o")
    .replace(/[úÚ]/g,m=>m==="Ú"?"U":"u").replace(/[üÜ]/g,m=>m==="Ü"?"U":"u")
    .toLocaleLowerCase("es");
}
function variants(expected: string) { return expected.split(/\s*\/\s*/).map(normalize).filter(Boolean); }
function scoreField(typed: string, expected: string) {
  const t=normalize(typed); if(!t) return 0; const vs=variants(expected); if(vs.includes(t)) return 1;
  const ft=accentCaseFold(t); for(const v of vs) if(accentCaseFold(v)===ft) return .5; return 0;
}
function responseParts(responseText: string, count: number) {
  let payload:any={translation:"",forms:[]}; try{payload=JSON.parse(responseText||"{}")}catch{}
  const parts=[String(payload.translation||"")];
  for(let i=1;i<count;i++) parts.push(String(payload.forms?.[i-1]||""));
  return parts;
}
async function recalcSubmission(admin:any, submissionId:string, testId:string, testType:string) {
  const {data:answers,error:answersError}=await admin.from("answers")
    .select("question_id,auto_points,teacher_points").eq("submission_id",submissionId);
  if(answersError) throw answersError;
  const {data:questions,error:qError}=await admin.from("test_questions")
    .select("id,accepted_answers_snapshot,question_meta").eq("test_id",testId);
  if(qError) throw qError;
  const scoreByQuestion=new Map((answers||[]).map((a:any)=>[String(a.question_id),a.teacher_points===null||a.teacher_points===undefined?Number(a.auto_points||0):Number(a.teacher_points||0)]));
  let raw=0,max=0,vocabRaw=0,vocabMax=0,grammarRaw=0,grammarMax=0;
  for(const q of questions||[]){
    const isVocab=testType==="combined"&&q.question_meta?.kind==="vocab";
    const qMax=isVocab?1:(testType==="grammar"||testType==="combined"?Math.max(1,Array.isArray(q.accepted_answers_snapshot)?q.accepted_answers_snapshot.length:0):1);
    const pts=Number(scoreByQuestion.get(String(q.id))||0);
    raw+=pts;max+=qMax;
    if(testType==="combined"){if(isVocab){vocabRaw+=pts;vocabMax+=qMax}else{grammarRaw+=pts;grammarMax+=qMax}}
  }
  const percent=max?Math.round(raw/max*1000)/10:0, upper=pointsForPercent(percent), grade=gradeForPoints(upper);
  const gradePart=(points:number,possible:number)=>gradeForPoints(pointsForPercent(possible?points/possible*100:0));
  const {data:metaRows}=await admin.from("test_questions").select("question_meta").eq("test_id",testId).limit(1);
  const separate=testType==="combined"&&(metaRows||[]).some((q:any)=>q.question_meta?.gradingMode==="separate");
  const gradeBreakdown={vocabulary:{points:vocabRaw,maxPoints:vocabMax,percent:vocabMax?Math.round(vocabRaw/vocabMax*1000)/10:0,grade:gradePart(vocabRaw,vocabMax)},grammar:{points:grammarRaw,maxPoints:grammarMax,percent:grammarMax?Math.round(grammarRaw/grammarMax*1000)/10:0,grade:gradePart(grammarRaw,grammarMax)}};
  const gradeText=separate?`Vokabeln: ${gradeBreakdown.vocabulary.grade} · Grammatik: ${gradeBreakdown.grammar.grade}`:grade;
  const {error:updateError}=await admin.from("submissions").update({
    raw_points:raw,max_points:max,percent,grade_text:gradeText,upper_school_points:upper
  }).eq("id",submissionId);
  if(updateError) throw updateError;
  return {rawPoints:raw,maxPoints:max,percent,gradeText,upperSchoolPoints:upper,gradeBreakdown};
}

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST") return json({error:"Method not allowed"},405);
  try{
    const authHeader=req.headers.get("Authorization");
    if(!authHeader?.startsWith("Bearer ")) return json({error:"Nicht angemeldet."},401);

    const url=Deno.env.get("SUPABASE_URL")!;
    const pubKeys=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
    const secretKeys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    const pub=pubKeys.default||Deno.env.get("SUPABASE_ANON_KEY");
    const secret=secretKeys.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!pub||!secret) return json({error:"Serverkonfiguration unvollständig."},500);

    const userClient=createClient(url,pub,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});
    const admin=createClient(url,secret,{auth:{persistSession:false}});
    const token=authHeader.replace("Bearer ","");
    const {data:userData,error:userError}=await userClient.auth.getUser(token);
    if(userError||!userData.user) return json({error:"Anmeldung ungültig."},401);

    const {data:teacher,error:teacherError}=await admin.from("teacher_profiles").select("approved")
      .eq("user_id",userData.user.id).maybeSingle();
    if(teacherError) throw teacherError;
    if(!teacher?.approved) return json({error:"Lehrerzugang nicht freigeschaltet."},403);

    const body=await req.json(), action=String(body?.action||"");
    if(!["adjust-answer","adjust-grammar-part"].includes(action)) return json({error:"Unbekannte Aktion."},400);

    const answerId=Number(body?.answerId), mode=String(body?.mode||"");
    if(!Number.isInteger(answerId)||!["auto","correct","half","wrong"].includes(mode))
      return json({error:"Ungültige Korrekturangabe."},400);

    const {data:answer,error:answerError}=await admin.from("answers")
      .select("id,submission_id,question_id,response_text,auto_points,teacher_points,teacher_adjustments")
      .eq("id",answerId).maybeSingle();
    if(answerError) throw answerError;
    if(!answer) return json({error:"Antwort nicht gefunden."},404);

    const {data:submission,error:subError}=await admin.from("submissions")
      .select("id,test_id,status").eq("id",answer.submission_id).maybeSingle();
    if(subError) throw subError;
    if(!submission) return json({error:"Abgabe nicht gefunden."},404);

    const {data:test,error:testError}=await admin.from("tests")
      .select("id,owner_id,test_type").eq("id",submission.test_id).maybeSingle();
    if(testError) throw testError;
    if(!test||test.owner_id!==userData.user.id) return json({error:"Keine Berechtigung für diese Abgabe."},403);

    if(action==="adjust-answer"){
      const teacherPoints=mode==="auto"?null:(mode==="correct"?1:mode==="half"?.5:0);
      const {error:updateError}=await admin.from("answers")
        .update({teacher_points:teacherPoints,updated_at:new Date().toISOString()}).eq("id",answerId);
      if(updateError) throw updateError;
      const summary=await recalcSubmission(admin,submission.id,submission.test_id,String(test.test_type||"vocab"));
      return json({ok:true,summary});
    }

    if(!["grammar","combined"].includes(String(test.test_type)))
      return json({error:"Diese Korrektur ist nur für Grammatiktests vorgesehen."},400);

    const partIndex=Number(body?.partIndex);
    const {data:question,error:qError}=await admin.from("test_questions")
      .select("id,accepted_answers_snapshot,question_meta").eq("id",answer.question_id).maybeSingle();
    if(qError) throw qError;
    if(!question) return json({error:"Aufgabe nicht gefunden."},404);

    const expected=Array.isArray(question.accepted_answers_snapshot)?question.accepted_answers_snapshot.map(String):[];
    const isVocab=question.question_meta?.kind==="vocab";
    const partCount=isVocab?1:expected.length;
    if(!Number.isInteger(partIndex)||partIndex<0||partIndex>=partCount)
      return json({error:"Ungültiger Aufgabenteil."},400);

    const typedParts=responseParts(String(answer.response_text||""),isVocab?1:expected.length);
    const autoPartPoints=isVocab
      ? [Math.max(0,...expected.map((e:string)=>scoreField(typedParts[0]||"",e)))]
      : expected.map((e:string,i:number)=>scoreField(typedParts[i]||"",e));
    const adjustments:Record<string,number>=answer.teacher_adjustments&&typeof answer.teacher_adjustments==="object"&&!Array.isArray(answer.teacher_adjustments)
      ? {...answer.teacher_adjustments} : {};
    const key=String(partIndex);
    if(mode==="auto") delete adjustments[key];
    else adjustments[key]=mode==="correct"?1:mode==="half"?.5:0;

    const hasAdjustments=Object.keys(adjustments).length>0;
    const effectiveParts=autoPartPoints.map((p:number,i:number)=>
      Object.prototype.hasOwnProperty.call(adjustments,String(i))?Number(adjustments[String(i)]):p
    );
    const teacherPoints=hasAdjustments?effectiveParts.reduce((sum:number,p:number)=>sum+Number(p||0),0):null;

    const {error:updateError}=await admin.from("answers").update({
      teacher_adjustments:adjustments,teacher_points:teacherPoints,updated_at:new Date().toISOString()
    }).eq("id",answerId);
    if(updateError) throw updateError;

    const summary=await recalcSubmission(admin,submission.id,submission.test_id,String(test.test_type||"grammar"));
    return json({ok:true,summary,answer:{teacherPoints,teacherAdjustments:adjustments,effectivePartPoints:effectiveParts}});
  }catch(err){
    console.error(err);
    return json({error:"Die Nachkorrektur konnte nicht gespeichert werden."},500);
  }
});
