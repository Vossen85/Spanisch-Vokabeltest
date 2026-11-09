import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function normalize(s: unknown) {
  return String(s ?? "").normalize("NFC").trim().replace(/,/g, " ").replace(/\\s*\\/\\s*/g, " ").replace(/\\s+/g, " ").replace(/^[¿¡"'“”‘’\\s]+|[?!.,"'“”‘’\\s]+$/g, "");
}
function fold(s: string) {
  return s.replace(/[áÁ]/g,m=>m==="Á"?"A":"a").replace(/[éÉ]/g,m=>m==="É"?"E":"e").replace(/[íÍ]/g,m=>m==="Í"?"I":"i").replace(/[óÓ]/g,m=>m==="Ó"?"O":"o").replace(/[úÚ]/g,m=>m==="Ú"?"U":"u").replace(/[üÜ]/g,m=>m==="Ü"?"U":"u").toLocaleLowerCase("es");
}
function variantsFromExpected(expected: string) {
  const set = new Set<string>();
  for (const part of (expected.includes(" / ") ? expected.split(/\\s+\\/\\s+/) : [expected])) {
    const t=part.trim(); if(!t)continue; set.add(normalize(t));
    const m=t.match(/^(.*?)\\s*\\(([^()]*)\\)\\s*(.*)$/);
    if(m){
      const before=m[1].trim(),inside=m[2].trim(),after=m[3].trim();
      const without=[before,after].filter(Boolean).join(" ").trim();if(without)set.add(normalize(without));
      const ci=inside.replace(/^\\+\\s*/,"").trim();
      if(ci&&!ci.includes("/")){const withInside=[before,ci,after].filter(Boolean).join(" ").trim();if(withInside)set.add(normalize(withInside))}
    }
  }
  set.delete("");return [...set];
}
function genderShort(t:string,e:string) {
  const a=t.split(" ").filter(Boolean),b=e.split(" ").filter(Boolean);
  if(a.length!==2||b.length!==2||a[0]!==b[0])return false;
  const suffix=a[1].replace(/^-/,"");return ["a","o","as","os"].includes(suffix)&&b[1].endsWith(suffix);
}
function scoreVocab(typed:string,expected:string[]) {
  const t=normalize(typed);if(!t)return 0;
  const set=new Set(expected.flatMap(x=>variantsFromExpected(String(x))));
  if(set.has(t)||[...set].some(e=>genderShort(t,e)))return 1;
  const ft=fold(t);return [...set].some(e=>fold(e)===ft||genderShort(ft,fold(e)))?.5:0;
}
function scoreField(typed:string,expected:string) {
  const t=normalize(typed);if(!t)return 0;
  const options=expected.split(/\\s*\\/\\s*/).map(normalize).filter(Boolean);
  if(options.includes(t))return 1;
  return options.some(x=>fold(x)===fold(t))?.5:0;
}
function pointsForPercent(p:number) {
  if(p>=95)return 15;if(p>=90)return 14;if(p>=85)return 13;if(p>=80)return 12;if(p>=75)return 11;if(p>=70)return 10;if(p>=65)return 9;if(p>=60)return 8;if(p>=55)return 7;if(p>=50)return 6;if(p>=45)return 5;if(p>=39)return 4;if(p>=33)return 3;if(p>=27)return 2;if(p>=20)return 1;return 0;
}
function gradeForPoints(p:number) { return ["6","5-","5","5+","4-","4","4+","3-","3","3+","2-","2","2+","1-","1","1+"][p]||"6"; }
function labelKey(s:unknown) { return String(s??"").normalize("NFD").replace(/[\\u0300-\\u036f]/g,"").toLocaleLowerCase("de").replace(/[^a-z0-9]/g,""); }
function cleanText(s:unknown,max=300) { return String(s??"").slice(0,max); }

Deno.serve(async (req: Request) => {
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  if(req.method!=="POST")return json({error:"Method not allowed"},405);
  try {
    const authHeader=req.headers.get("Authorization");
    if(!authHeader?.startsWith("Bearer "))return json({error:"Nicht angemeldet."},401);
    const url=Deno.env.get("SUPABASE_URL")!;
    const pubKeys=JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")||"{}");
    const secretKeys=JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS")||"{}");
    const pub=pubKeys.default||Deno.env.get("SUPABASE_ANON_KEY");
    const secret=secretKeys.default||Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if(!url||!pub||!secret)return json({error:"Serverkonfiguration unvollständig."},500);
    const userClient=createClient(url,pub,{global:{headers:{Authorization:authHeader}},auth:{persistSession:false}});
    const admin=createClient(url,secret,{auth:{persistSession:false}});
    const token=authHeader.replace("Bearer ","");
    const {data:userData,error:userError}=await userClient.auth.getUser(token);
    if(userError||!userData.user)return json({error:"Anmeldung ungültig."},401);
    const {data:teacher,error:teacherError}=await admin.from("teacher_profiles").select("approved").eq("user_id",userData.user.id).maybeSingle();
    if(teacherError)throw teacherError;
    if(!teacher?.approved)return json({error:"Lehrerzugang nicht freigeschaltet."},403);

    const body=await req.json(),testId=String(body?.testId||""),courseId=String(body?.courseId||""),students=body?.students;
    if(!testId||!courseId||!Array.isArray(students)||!students.length||students.length>60)return json({error:"Bitte Test, Kurs und höchstens 60 Schüler auswählen."},400);
    const {data:test,error:testError}=await admin.from("tests").select("id,owner_id,title,test_date,duration_minutes,test_type,course_id").eq("id",testId).maybeSingle();
    if(testError)throw testError;
    if(!test||test.owner_id!==userData.user.id)return json({error:"Dieser Test gehört nicht zu deinem Lehreraccount."},403);
    const type=String(test.test_type||"vocab");
    const {data:course,error:courseError}=await admin.from("teacher_courses").select("id").eq("id",courseId).eq("owner_id",userData.user.id).eq("active",true).maybeSingle();
    if(courseError)throw courseError;
    if(!course)return json({error:"Der ausgewählte Kurs ist nicht verfügbar."},400);
    if(test.course_id&&String(test.course_id)!==courseId)return json({error:"Dieser Test ist bereits einem anderen Kurs zugeordnet. Bitte wähle den passenden Test oder Kurs."},400);

    const {data:roster,error:rosterError}=await admin.from("course_students").select("user_id,student_number,active").eq("course_id",courseId).eq("active",true);
    if(rosterError)throw rosterError;
    const rosterMap=new Map((roster||[]).map((s:any)=>[String(s.student_number),s]));
    const {data:questions,error:qError}=await admin.from("test_questions").select("id,position,accepted_answers_snapshot,question_meta").eq("test_id",testId).order("position");
    if(qError)throw qError;
    if(!questions?.length)return json({error:"Der ausgewählte Test enthält keine Aufgaben."},400);
    const questionMap=new Map((questions as any[]).map(q=>[Number(q.position),q]));
    const inputCodes:string[]=[];
    const validated:any[]=[];
    for(const student of students){
      const code=String(student?.studentNumber??"").trim();
      if(!/^\\d{1,3}$/.test(code))return json({error:"Eine Schülernummer fehlt oder ist ungültig."},400);
      const rosterStudent=rosterMap.get(String(Number(code)));
      if(!rosterStudent)return json({error:"Schülernummer "+code+" ist im ausgewählten Kurs nicht aktiv angelegt."},400);
      if(inputCodes.includes(String(Number(code))))return json({error:"Die CSV enthält Schülernummer "+code+" mehrfach."},400);
      inputCodes.push(String(Number(code)));
      if(!Array.isArray(student.answers))return json({error:"Antworten für Schüler "+code+" sind nicht lesbar."},400);
      const byPos=new Map<number,any>();
      for(const item of student.answers){
        const pos=Number(item?.position);
        if(!Number.isInteger(pos)||!questionMap.has(pos))return json({error:"Aufgabe "+String(item?.position||"?")+" ist im ausgewählten Test nicht vorhanden."},400);
        if(byPos.has(pos))return json({error:"Aufgabe "+pos+" ist in der CSV für Schüler "+code+" doppelt vorhanden."},400);
        const fields=item?.fields&&typeof item.fields==="object"&&!Array.isArray(item.fields)?item.fields:{};
        byPos.set(pos,fields);
      }
      validated.push({code,rosterStudent,byPos});
    }
    const {data:existing,error:existingError}=await admin.from("submissions").select("student_code").eq("test_id",testId).in("student_code",inputCodes);
    if(existingError)throw existingError;
    if(existing?.length)return json({error:"Für folgende Schülernummern gibt es zu diesem Test bereits eine Abgabe: "+existing.map((x:any)=>x.student_code).join(", ")+". Es wurde nichts importiert."},409);

    const maxPoints=(questions as any[]).reduce((sum,q)=>sum+(Array.isArray(q.accepted_answers_snapshot)?q.accepted_answers_snapshot.length:0),0);
    const parsedDate=new Date(String(test.test_date)+"T12:00:00.000Z");
    const startedAt=new Date(parsedDate.getTime()-Math.max(1,Number(test.duration_minutes)||35)*60000).toISOString();
    const submittedAt=parsedDate.toISOString();
    const deadlineAt=parsedDate.toISOString();
    const submissionRows:any[]=[],answerPayloads:any[]=[];
    for(const entry of validated){
      let raw=0;
      const perQuestion:any[]=[];
      for(const q of questions as any[]){
        const fields=entry.byPos.get(Number(q.position))||{};
        const expected=Array.isArray(q.accepted_answers_snapshot)?q.accepted_answers_snapshot.map(String):[];
        let responseText="",points=0;
        if(type==="grammar"){
          const labels=Array.isArray(q.question_meta?.labels)?q.question_meta.labels.map(String):[];
          const normalizedFields=new Map(Object.entries(fields).map(([k,v])=>[labelKey(k),String(v??"")]));
          const translationKey=["bedeutung","deutschebedeutung","ubersetzung","translation","meaning"].find(k=>normalizedFields.has(k));
          const translation=cleanText(translationKey?normalizedFields.get(translationKey):"");
          const forms=labels.map((label:string)=>cleanText(normalizedFields.get(labelKey(label))||""));
          for(let i=0;i<expected.length;i++)points+=scoreField(i===0?translation:forms[i-1]||"",expected[i]||"");
          responseText=JSON.stringify({translation,forms});
        }else{
          const normalizedFields=new Map(Object.entries(fields).map(([k,v])=>[labelKey(k),String(v??"")]));
          const answerKey=["antwort","schulerantwort","answer","translation","ubersetzung","bedeutung"].find(k=>normalizedFields.has(k));
          const typed=cleanText(answerKey?normalizedFields.get(answerKey):"");
          points=scoreVocab(typed,expected);
          responseText=typed;
        }
        raw+=points;
        perQuestion.push({question_id:q.id,response_text:responseText,auto_correct:points===(type==="grammar"?expected.length:1),auto_points:points,updated_at:new Date().toISOString()});
      }
      const percent=maxPoints?Math.round(raw/maxPoints*1000)/10:0,op=pointsForPercent(percent);
      submissionRows.push({test_id:testId,student_code:entry.code,student_user_id:entry.rosterStudent.user_id,started_at:startedAt,deadline_at:deadlineAt,submitted_at:submittedAt,auto_submitted:false,status:"submitted",raw_points:raw,max_points:maxPoints,percent,grade_text:gradeForPoints(op),upper_school_points:op});
      answerPayloads.push(perQuestion);
    }
    let inserted:any[]=[];
    try{
      const {data,error}=await admin.from("submissions").insert(submissionRows).select("id,student_code");
      if(error)throw error;
      inserted=data||[];
      const answerRows:any[]=[];
      for(const sub of inserted){
        const ix=submissionRows.findIndex((r:any)=>r.student_code===sub.student_code);
        for(const a of answerPayloads[ix])answerRows.push({...a,submission_id:sub.id});
      }
      const {error:answerError}=await admin.from("answers").insert(answerRows);
      if(answerError)throw answerError;
    }catch(error){
      if(inserted.length)await admin.from("submissions").delete().in("id",inserted.map((s:any)=>s.id));
      throw error;
    }
    return json({ok:true,imported:inserted.length,testTitle:test.title||"Test"});
  }catch(err){
    console.error("Analogtest-Import fehlgeschlagen:",err);
    return json({error:"Der Import ist fehlgeschlagen. Bitte prüfe CSV und Kurszuordnung und versuche es erneut."},500);
  }
});
