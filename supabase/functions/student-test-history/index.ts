import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS"
};
function json(body:unknown,status=200){
  return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
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
      .select("id,title,test_date,quarter_number,course_id").in("id",testIds);
    if(testError)throw testError;
    const courseIds=[...new Set((tests||[]).map((t:any)=>t.course_id).filter(Boolean))];
    let courses:any[]=[];
    if(courseIds.length){
      const {data,error}=await admin.from("teacher_courses").select("id,name").in("id",courseIds);
      if(error)throw error;
      courses=data||[];
    }
    const testMap=new Map((tests||[]).map((t:any)=>[String(t.id),t]));
    const courseMap=new Map(courses.map((c:any)=>[String(c.id),c.name]));
    return json({ok:true,results:(subs||[]).map((s:any)=>{
      const t:any=testMap.get(String(s.test_id))||{};
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
        quarterNumber:t.quarter_number||null
      };
    })});
  }catch(err){
    console.error(err);
    return json({error:"Deine Testergebnisse konnten nicht geladen werden."},500);
  }
});