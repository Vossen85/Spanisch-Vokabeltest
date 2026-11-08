import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
}
function normalizeAnswer(value:unknown){
  return String(value??"").normalize("NFC").trim().replace(/^[¿¡!"'“”‘’\s]+|[?!.,!"'“”‘’\s]+$/g,"").replace(/\s+/g," ");
}
function accentCaseFold(value:string){
  return value.replace(/[áÁ]/g,m=>m==="Á"?"A":"a").replace(/[éÉ]/g,m=>m==="É"?"E":"e").replace(/[íÍ]/g,m=>m==="Í"?"I":"i").replace(/[óÓ]/g,m=>m==="Ó"?"O":"o").replace(/[úÚ]/g,m=>m==="Ú"?"U":"u").replace(/[üÜ]/g,m=>m==="Ü"?"U":"u").toLocaleLowerCase("es");
}
function scoreField(typed:string,expected:string){
  const t=normalizeAnswer(typed);
  if(!t)return 0;
  const variants=expected.split(/\s*\/\s*/).map(normalizeAnswer).filter(Boolean);
  if(variants.includes(t))return 1;
  const folded=accentCaseFold(t);
  return variants.some(v=>accentCaseFold(v)===folded)?0.5:0;
}
Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try{
    const authHeader=req.headers.get("Authorization")||"";
    if(!authHeader.startsWith("Bearer "))return json({error:"Bitte melde dich mit deinem Schülercode an."},401);
    const url=Deno.env.get("SUPABASE_URL")!;
    const publishableKeys=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
    const secretKeys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    const publishableKey=publishableKeys.default||Deno.env.get("SUPABASE_ANON_KEY");
    const secretKey=secretKeys.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!publishableKey||!secretKey)return json({error:"Serverkonfiguration unvollständig."},500);
    const userClient=createClient(url,publishableKey,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});
    const admin=createClient(url,secretKey,{auth:{persistSession:false}});
    const token=authHeader.replace("Bearer ","");
    const {data:userData,error:userError}=await userClient.auth.getUser(token);
    if(userError||!userData.user)return json({error:"Anmeldung ungültig."},401);
    const {data:subs,error:subError}=await admin.from("submissions")
      .select("id,test_id,submitted_at,raw_points,max_points,percent,grade_text,upper_school_points")
      .eq("student_user_id",userData.user.id).eq("status","submitted").order("submitted_at",{ascending:false});
    if(subError)throw subError;
    const testIds=[...new Set((subs||[]).map((s:any)=>s.test_id))];
    if(!testIds.length)return json({ok:true,results:[]});
    const {data:tests,error:testError}=await admin.from("tests")
      .select("id,title,test_date,quarter_number,course_id,test_type").in("id",testIds);
    if(testError)throw testError;
    const courseIds=[...new Set((tests||[]).map((t:any)=>t.course_id).filter(Boolean))];
    let courses:any[]=[];
    if(courseIds.length){
      const {data,error}=await admin.from("teacher_courses").select("id,name").in("id",courseIds);
      if(error)throw error;
      courses=data||[];
    }
    const {data:questions,error:questionError}=await admin.from("test_questions")
      .select("id,test_id,position,source_snapshot,accepted_answers_snapshot,question_meta")
      .in("test_id",testIds).order("position");
    if(questionError)throw questionError;
    const submissionIds=(subs||[]).map((x:any)=>x.id);
    const {data:answerRows,error:answerError}=await admin.from("answers")
      .select("submission_id,question_id,response_text,auto_points,teacher_points,teacher_adjustments")
      .in("submission_id",submissionIds);
    if(answerError)throw answerError;
    const testMap=new Map((tests||[]).map((t:any)=>[String(t.id),t]));
    const courseMap=new Map(courses.map((c:any)=>[String(c.id),c.name]));
    const questionsByTest=new Map<string,any[]>();
    for(const q of questions||[]){
      const key=String(q.test_id);
      if(!questionsByTest.has(key))questionsByTest.set(key,[]);
      questionsByTest.get(key)!.push(q);
    }
    const answersBySubmission=new Map<string,Map<string,any>>();
    for(const a of answerRows||[]){
      const key=String(a.submission_id);
      if(!answersBySubmission.has(key))answersBySubmission.set(key,new Map());
      answersBySubmission.get(key)!.set(String(a.question_id),a);
    }
    const results=(subs||[]).map((s:any)=>{
      const t:any=testMap.get(String(s.test_id))||{};
      const answers=answersBySubmission.get(String(s.id))||new Map();
      const corrections=(questionsByTest.get(String(s.test_id))||[]).map((q:any)=>{
        const a:any=answers.get(String(q.id))||{};
        const accepted=Array.isArray(q.accepted_answers_snapshot)?q.accepted_answers_snapshot.map((x:any)=>String(x??"")):[];
        if(t.test_type==="grammar"){
          let payload:any={translation:"",forms:[]};
          try{payload=JSON.parse(a.response_text||"{}")}catch{}
          const labels=Array.isArray(q.question_meta?.labels)?q.question_meta.labels:[];
          const adjustments=a.teacher_adjustments&&typeof a.teacher_adjustments==="object"&&!Array.isArray(a.teacher_adjustments)?a.teacher_adjustments:{};
          const inputs=[
            {label:"Übersetzung",responseText:String(payload.translation||""),expected:accepted[0]||""},
            ...accepted.slice(1).map((expected:string,i:number)=>({label:String(labels[i]||("Form "+(i+1))),responseText:String(payload.forms?.[i]||""),expected}))
          ];
          const fields=inputs.map((x:any,i:number)=>({
            label:x.label,
            responseText:x.responseText,
            acceptedAnswers:[x.expected].filter(Boolean),
            points:Object.prototype.hasOwnProperty.call(adjustments,String(i))
              ?Number(adjustments[String(i)]||0)
              :scoreField(x.responseText,x.expected),
            maxPoints:1
          }));
          const hasAdjustments=Object.keys(adjustments).length>0;
          const points=hasAdjustments
            ?fields.reduce((sum:any,x:any)=>sum+Number(x.points||0),0)
            :Number(a.teacher_points??a.auto_points??fields.reduce((sum:any,x:any)=>sum+Number(x.points||0),0));
          return {
            position:q.position,sourceText:q.source_snapshot||"",
            topicGroup:q.question_meta?.topicGroup||"",topicTitle:q.question_meta?.topicTitle||"",
            points,maxPoints:accepted.length,fields
          };
        }
        const points=a.teacher_points===null||a.teacher_points===undefined?Number(a.auto_points||0):Number(a.teacher_points||0);
        return {
          position:q.position,sourceText:q.source_snapshot||"",
          points,maxPoints:1,
          fields:[{label:"Antwort",responseText:String(a.response_text||""),acceptedAnswers:accepted,points,maxPoints:1}]
        };
      });
      return {
        submittedAt:s.submitted_at,
        rawPoints:Number(s.raw_points||0),
        maxPoints:Number(s.max_points||0),
        percent:Number(s.percent||0),
        gradeText:s.grade_text||"—",
        upperSchoolPoints:Number(s.upper_school_points||0),
        testTitle:t.title||"Test",
        testDate:t.test_date||null,
        courseName:t.course_id?courseMap.get(String(t.course_id))||"Kurs":"Kurs",
        quarterNumber:t.quarter_number||null,
        corrections
      };
    });
    return json({ok:true,results});
  }catch(err){
    console.error(err);
    return json({error:"Deine Testergebnisse konnten nicht geladen werden."},500);
  }
});