
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !secretKey) throw new Error("Server configuration missing");
  return createClient(url, secretKey, { auth: { persistSession: false } });
}

function normalize(s: unknown) {
  return String(s ?? "")
    .normalize("NFC")
    .trim()
    .replace(/,/g, " ")
    .replace(/\s*\/\s*/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[¿¡"'“”‘’\s]+|[?!.,"'“”‘’\s]+$/g, "");
}

function accentCaseFold(s: string) {
  return s
    .replace(/[áÁ]/g, m => m === "Á" ? "A" : "a")
    .replace(/[éÉ]/g, m => m === "É" ? "E" : "e")
    .replace(/[íÍ]/g, m => m === "Í" ? "I" : "i")
    .replace(/[óÓ]/g, m => m === "Ó" ? "O" : "o")
    .replace(/[úÚ]/g, m => m === "Ú" ? "U" : "u")
    .replace(/[üÜ]/g, m => m === "Ü" ? "U" : "u")
    .toLocaleLowerCase("es");
}

function genderShorthandMatches(typed: string, expected: string) {
  const t = typed.split(" ").filter(Boolean);
  const e = expected.split(" ").filter(Boolean);
  if (t.length !== 2 || e.length !== 2) return false;
  if (t[0] !== e[0]) return false;

  const suffix = t[1].replace(/^-/, "");
  if (!["a","o","as","os"].includes(suffix)) return false;

  return e[1].endsWith(suffix);
}

function scoreAgainstExpected(typed: string, expectedVariants: Set<string>) {
  const typedNorm = normalize(typed);
  if (!typedNorm) return 0;
  if (expectedVariants.has(typedNorm)) return 1;

  for (const expected of expectedVariants) {
    if (genderShorthandMatches(typedNorm, expected)) return 1;
  }

  const tolerant = accentCaseFold(typedNorm);
  for (const expected of expectedVariants) {
    const expectedTolerant = accentCaseFold(expected);
    if (expectedTolerant === tolerant) return 0.5;
    if (genderShorthandMatches(tolerant, expectedTolerant)) return 0.5;
  }
  return 0;
}

function splitTopLevelCommas(s: string) {
  const parts: string[] = [];
  let cur = "";
  let depth = 0;
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      if (cur.trim()) parts.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

function variantsFromExpected(expected: string) {
  const set = new Set<string>();
  const slashParts = expected.includes(" / ") ? expected.split(/\s+\/\s+/) : [expected];
  for (const part of slashParts) {
    const t = part.trim();
    if (!t) continue;
    set.add(normalize(t));
    const m = t.match(/^(.*?)\s*\(([^()]*)\)\s*(.*)$/);
    if (m) {
      const before = m[1].trim();
      const inside = m[2].trim();
      const after = m[3].trim();
      const without = [before, after].filter(Boolean).join(" ").trim();
      if (without) set.add(normalize(without));
      const ci = inside.replace(/^\+\s*/, "").trim();
      if (ci && !ci.includes("/")) {
        const withInside = [before, ci, after].filter(Boolean).join(" ").trim();
        if (withInside) set.add(normalize(withInside));
      }
    }
  }
  set.delete("");
  return [...set];
}

function pointsForPercent(p: number) {
  if (p >= 95) return 15;
  if (p >= 90) return 14;
  if (p >= 85) return 13;
  if (p >= 80) return 12;
  if (p >= 75) return 11;
  if (p >= 70) return 10;
  if (p >= 65) return 9;
  if (p >= 60) return 8;
  if (p >= 55) return 7;
  if (p >= 50) return 6;
  if (p >= 45) return 5;
  if (p >= 39) return 4;
  if (p >= 33) return 3;
  if (p >= 27) return 2;
  if (p >= 20) return 1;
  return 0;
}

function gradeForPoints(p: number) {
  return ["6","5-","5","5+","4-","4","4+","3-","3","3+","2-","2","2+","1-","1","1+"][p] || "6";
}

async function getTestByCode(admin: any, code: string) {
  const { data, error } = await admin
    .from("tests")
    .select("id,public_code,title,test_date,question_count,duration_minutes,status,course_id,quarter_number")
    .eq("public_code", code)
    .maybeSingle();
  if (error) throw error;
  return data;
}


async function courseNameForTest(admin: any, test: any) {
  if (!test.course_id) return "";
  const { data, error } = await admin.from("teacher_courses").select("name").eq("id", test.course_id).maybeSingle();
  if (error) throw error;
  return data?.name || "";
}
async function studentForTest(admin: any, test: any, studentCode: string) {
  if (!test.course_id) return { userId: null, error: null };
  const { data, error } = await admin.from("course_students")
    .select("user_id").eq("course_id", test.course_id).eq("student_number", Number(studentCode)).eq("active", true).maybeSingle();
  if (error) throw error;
  if (!data) return { userId: null, error: "Diese Schülernummer ist im zugeordneten Kurs nicht vergeben. Bitte prüfe die Nummer." };
  return { userId: data.user_id, error: null };
}
async function getQuestions(admin: any, testId: string, includeAnswers = false) {
  const select = includeAnswers
    ? "id,position,source_snapshot,accepted_answers_snapshot"
    : "id,position,source_snapshot";
  const { data, error } = await admin
    .from("test_questions")
    .select(select)
    .eq("test_id", testId)
    .order("position");
  if (error) throw error;
  return data || [];
}

async function getSubmissionByToken(admin: any, token: string) {
  const { data, error } = await admin
    .from("submissions")
    .select("id,test_id,student_code,started_at,deadline_at,submitted_at,status,access_token")
    .eq("access_token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function saveAnswers(admin: any, sub: any, incoming: any[]) {
  if (!Array.isArray(incoming) || !incoming.length) return;
  const questions = await getQuestions(admin, sub.test_id, false);
  const validIds = new Set(questions.map((q: any) => String(q.id)));
  const rows = [];
  for (const a of incoming) {
    const qid = String(a?.questionId ?? "");
    if (!validIds.has(qid)) continue;
    rows.push({
      submission_id: sub.id,
      question_id: qid,
      response_text: String(a?.responseText ?? "").slice(0, 1000),
      updated_at: new Date().toISOString(),
    });
  }
  if (!rows.length) return;
  const { error } = await admin
    .from("answers")
    .upsert(rows, { onConflict: "submission_id,question_id" });
  if (error) throw error;
}

async function finalize(admin: any, sub: any, autoSubmitted: boolean) {
  if (sub.status === "submitted") return;
  const questions = await getQuestions(admin, sub.test_id, true);
  const { data: answerRows, error: answerError } = await admin
    .from("answers")
    .select("question_id,response_text")
    .eq("submission_id", sub.id);
  if (answerError) throw answerError;

  const answerMap = new Map((answerRows || []).map((a: any) => [String(a.question_id), a.response_text || ""]));
  const gradedRows: any[] = [];
  let totalPoints = 0;

  for (const q of questions as any[]) {
    const typed = answerMap.get(String(q.id)) || "";
    const expectedVariants = new Set<string>();
    for (const expected of (q.accepted_answers_snapshot || [])) {
      for (const v of variantsFromExpected(String(expected))) expectedVariants.add(v);
    }
    const points = scoreAgainstExpected(typed, expectedVariants);
    totalPoints += points;
    gradedRows.push({
      submission_id: sub.id,
      question_id: q.id,
      response_text: typed,
      auto_correct: points === 1,
      auto_points: points,
      updated_at: new Date().toISOString(),
    });
  }

  if (gradedRows.length) {
    const { error } = await admin
      .from("answers")
      .upsert(gradedRows, { onConflict: "submission_id,question_id" });
    if (error) throw error;
  }

  const max = questions.length;
  const percent = max ? Math.round((totalPoints / max) * 1000) / 10 : 0;
  const upperPoints = pointsForPercent(percent);
  const grade = gradeForPoints(upperPoints);

  const { error: updateError } = await admin
    .from("submissions")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      auto_submitted: autoSubmitted,
      raw_points: totalPoints,
      max_points: max,
      percent,
      grade_text: grade,
      upper_school_points: upperPoints,
    })
    .eq("id", sub.id);
  if (updateError) throw updateError;
}


async function buildResult(admin: any, sub: any) {
  const { data: freshSub, error: subError } = await admin
    .from("submissions")
    .select("id,test_id,student_code,submitted_at,raw_points,max_points,percent,grade_text,upper_school_points,status")
    .eq("id", sub.id)
    .single();
  if (subError) throw subError;

  const { data: test, error: testError } = await admin
    .from("tests")
    .select("title,test_date,question_count,duration_minutes")
    .eq("id", freshSub.test_id)
    .single();
  if (testError) throw testError;

  const questions = await getQuestions(admin, freshSub.test_id, true);
  const { data: answerRows, error: answerError } = await admin
    .from("answers")
    .select("question_id,response_text,auto_points,teacher_points")
    .eq("submission_id", freshSub.id);
  if (answerError) throw answerError;

  const answerMap = new Map((answerRows || []).map((a: any) => [String(a.question_id), a]));
  const corrections = (questions as any[]).map((q: any) => {
    const a: any = answerMap.get(String(q.id)) || {};
    const points = a.teacher_points === null || a.teacher_points === undefined
      ? Number(a.auto_points || 0)
      : Number(a.teacher_points || 0);
    return {
      position: q.position,
      sourceText: q.source_snapshot,
      responseText: a.response_text || "",
      acceptedAnswers: q.accepted_answers_snapshot || [],
      points,
    };
  });

  return {
    studentCode: freshSub.student_code,
    submittedAt: freshSub.submitted_at,
    test: {
      title: test.title || "Vokabeltest",
      testDate: test.test_date,
      questionCount: test.question_count,
      durationMinutes: test.duration_minutes,
    },
    summary: {
      rawPoints: Number(freshSub.raw_points || 0),
      maxPoints: Number(freshSub.max_points || 0),
      percent: Number(freshSub.percent || 0),
      gradeText: freshSub.grade_text || "—",
      upperSchoolPoints: Number(freshSub.upper_school_points || 0),
    },
    corrections,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const admin = getAdmin();
    const body = await req.json();
    const action = String(body?.action || "");
    const code = String(body?.code || "").trim().toUpperCase();

    if (action === "info") {
      if (!code) return response({ error: "Testcode fehlt." }, 400);
      const test = await getTestByCode(admin, code);
      if (!test || test.status !== "open") return response({ error: "Dieser Test ist nicht verfügbar." }, 404);
      return response({
        ok: true,
        test: {
          title: test.title || "Vokabeltest",
          testDate: test.test_date,
          questionCount: test.question_count,
          durationMinutes: test.duration_minutes,
          courseName: await courseNameForTest(admin, test),
          quarterNumber: test.quarter_number,
        },
      });
    }

    if (action === "start") {
      if (!code) return response({ error: "Testcode fehlt." }, 400);
      const studentCode = String(body?.studentCode || "").trim();
      if (!/^\d{1,12}$/.test(studentCode)) {
        return response({ error: "Bitte deine persönliche Schülernummer eingeben." }, 400);
      }
      const test = await getTestByCode(admin, code);
      if (!test || test.status !== "open") return response({ error: "Dieser Test ist nicht verfügbar." }, 404);

      const account = await studentForTest(admin, test, studentCode);
      if (account.error) return response({ error: account.error }, 400);
      const studentUserId = account.userId;

      const { data: existing, error: existingError } = await admin
        .from("submissions")
        .select("id,test_id,student_code,started_at,deadline_at,submitted_at,status,access_token")
        .eq("test_id", test.id)
        .eq("student_code", studentCode)
        .maybeSingle();
      if (existingError) throw existingError;

      const suppliedToken = String(body?.accessToken || "").trim();
      if (existing) {
        if (existing.status === "submitted") {
          if (!suppliedToken || suppliedToken !== String(existing.access_token)) {
            return response({ error: "Mit dieser Schülernummer wurde der Test bereits abgegeben." }, 409);
          }
          return response({ ok: true, submitted: true, result: await buildResult(admin, existing) });
        }
        if (!suppliedToken || suppliedToken !== String(existing.access_token)) {
          return response({ error: "Mit dieser Schülernummer wurde der Test bereits gestartet." }, 409);
        }
        const questions = await getQuestions(admin, test.id, false);
        const { data: saved } = await admin
          .from("answers")
          .select("question_id,response_text")
          .eq("submission_id", existing.id);
        return response({
          ok: true,
          resumed: true,
          accessToken: existing.access_token,
          studentCode: existing.student_code,
          deadlineAt: existing.deadline_at,
          test: {
            title: test.title || "Vokabeltest",
            testDate: test.test_date,
            questionCount: test.question_count,
            durationMinutes: test.duration_minutes,
          },
          questions,
          savedAnswers: saved || [],
        });
      }

      const deadline = new Date(Date.now() + Number(test.duration_minutes) * 60_000).toISOString();
      const { data: sub, error: insertError } = await admin
        .from("submissions")
        .insert({
          test_id: test.id,
          student_code: studentCode,
          student_user_id: studentUserId,
          deadline_at: deadline,
          max_points: test.question_count,
        })
        .select("id,access_token,deadline_at")
        .single();
      if (insertError) throw insertError;

      const questions = await getQuestions(admin, test.id, false);
      return response({
        ok: true,
        resumed: false,
        accessToken: sub.access_token,
        studentCode,
        deadlineAt: sub.deadline_at,
        test: {
          title: test.title || "Vokabeltest",
          testDate: test.test_date,
          questionCount: test.question_count,
          durationMinutes: test.duration_minutes,
          courseName: await courseNameForTest(admin, test),
          quarterNumber: test.quarter_number,
        },
        questions,
        savedAnswers: [],
      });
    }

    if (action === "session") {
      const token = String(body?.accessToken || "").trim();
      if (!token) return response({ error: "Sitzung fehlt." }, 401);
      const sub = await getSubmissionByToken(admin, token);
      if (!sub) return response({ error: "Sitzung nicht gefunden." }, 404);
      if (sub.status === "submitted") return response({ ok: true, submitted: true, result: await buildResult(admin, sub) });

      const test = await admin.from("tests")
        .select("title,test_date,question_count,duration_minutes,status")
        .eq("id", sub.test_id).single();
      if (test.error) throw test.error;
      const questions = await getQuestions(admin, sub.test_id, false);
      const { data: saved } = await admin.from("answers")
        .select("question_id,response_text")
        .eq("submission_id", sub.id);

      return response({
        ok: true,
        accessToken: token,
        studentCode: sub.student_code,
        deadlineAt: sub.deadline_at,
        test: {
          title: test.data.title || "Vokabeltest",
          testDate: test.data.test_date,
          questionCount: test.data.question_count,
          durationMinutes: test.data.duration_minutes,
        },
        questions,
        savedAnswers: saved || [],
      });
    }

    if (action === "save") {
      const token = String(body?.accessToken || "").trim();
      const sub = await getSubmissionByToken(admin, token);
      if (!sub) return response({ error: "Sitzung nicht gefunden." }, 404);
      if (sub.status === "submitted") return response({ ok: true, submitted: true });
      if (Date.now() >= new Date(sub.deadline_at).getTime()) {
        await finalize(admin, sub, true);
        return response({ ok: true, submitted: true, expired: true, result: await buildResult(admin, sub) });
      }
      await saveAnswers(admin, sub, body?.answers || []);
      return response({ ok: true, savedAt: new Date().toISOString() });
    }

    if (action === "submit") {
      const token = String(body?.accessToken || "").trim();
      const sub = await getSubmissionByToken(admin, token);
      if (!sub) return response({ error: "Sitzung nicht gefunden." }, 404);
      if (sub.status === "submitted") return response({ ok: true, submitted: true, result: await buildResult(admin, sub) });
      await saveAnswers(admin, sub, body?.answers || []);
      const expired = Date.now() >= new Date(sub.deadline_at).getTime();
      await finalize(admin, sub, Boolean(body?.auto) || expired);
      return response({ ok: true, submitted: true, result: await buildResult(admin, sub) });
    }

    return response({ error: "Unbekannte Aktion." }, 400);
  } catch (err) {
    console.error(err);
    return response({ error: "Der Test konnte gerade nicht verarbeitet werden." }, 500);
  }
});
