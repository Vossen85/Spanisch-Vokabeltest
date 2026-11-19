
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

async function fetchAllRows(queryFactory: () => any): Promise<any[]> {
  const pageSize = 500;
  const all: any[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await queryFactory().range(offset, offset + pageSize - 1);
    if (error) throw error;
    const page = data || [];
    all.push(...page);
    if (page.length < pageSize) break;
  }
  return all;
}

async function fetchRowsByIdChunks(ids: number[], queryFactory: (chunk: number[]) => any): Promise<any[]> {
  const all: any[] = [];
  const chunkSize = 200;
  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    all.push(...await fetchAllRows(() => queryFactory(ids.slice(offset, offset + chunkSize))));
  }
  return all;
}


function normalize(s: unknown) {
 return String(s ?? "").normalize("NFC").trim()
 .replace(/[(){}\[\],]/g," ")
 .replace(/\s*\/\s*/g," ")
 .replace(/\s+/g," ")
 .replace(/^[¿¡"'“”‘’\s]+|[?!.,"'“”‘’\s]+$/g,"").trim();
}
function comparisonKey(value: unknown): string {
 return normalize(value).replace(/\s+/g,"");
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
  if (t.length !== 2 || e.length !== 2 || t[0] !== e[0]) return false;
  const suffix = t[1].replace(/^-/, "");
  if (!["a","o","as","os"].includes(suffix)) return false;
  return e[1].endsWith(suffix);
}

function scoreAgainstExpected(typed: string, expectedVariants: Set<string>) {
 const typedNorm=normalize(typed), key=comparisonKey(typedNorm);
 if(!key)return 0;
 for(const expected of expectedVariants){
  if(comparisonKey(expected)===key)return 1;
  if(genderShorthandMatches(typedNorm,expected))return 1;
 }
 const tolerant=accentCaseFold(key);
 for(const expected of expectedVariants){
  if(accentCaseFold(comparisonKey(expected))===tolerant)return .5;
  if(genderShorthandMatches(accentCaseFold(typedNorm),accentCaseFold(expected)))return .5;
 }
 return 0;
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

function shuffle<T>(arr: T[]) {
  for (let i = arr.length - 1; i > 0; i--) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    const j = buf[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function getSession(admin: any, token: string) {
  const { data, error } = await admin
    .from("practice_sessions")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getQuestions(admin: any, sessionId: string, includeAnswers = false) {
  const select = includeAnswers
    ? "id,position,source_snapshot,accepted_answers_snapshot"
    : "id,position,source_snapshot";
  const { data, error } = await admin
    .from("practice_questions")
    .select(select)
    .eq("session_id", sessionId)
    .order("position");
  if (error) throw error;
  return data || [];
}

async function saveAnswers(admin: any, session: any, incoming: any[]) {
  if (!Array.isArray(incoming) || !incoming.length) return;
  const questions = await getQuestions(admin, session.id, false);
  const validIds = new Set(questions.map((q: any) => String(q.id)));
  const rows = [];
  for (const a of incoming) {
    const qid = String(a?.questionId ?? "");
    if (!validIds.has(qid)) continue;
    rows.push({
      session_id: session.id,
      question_id: qid,
      response_text: String(a?.responseText ?? "").slice(0, 1000),
      updated_at: new Date().toISOString(),
    });
  }
  if (!rows.length) return;
  const { error } = await admin
    .from("practice_answers")
    .upsert(rows, { onConflict: "session_id,question_id" });
  if (error) throw error;
}

async function finalize(admin: any, session: any) {
  if (session.status === "submitted") return;

  const questions = await getQuestions(admin, session.id, true);
  const { data: answerRows, error: answerError } = await admin
    .from("practice_answers")
    .select("question_id,response_text")
    .eq("session_id", session.id);
  if (answerError) throw answerError;

  const answerMap = new Map((answerRows || []).map((a: any) => [String(a.question_id), a.response_text || ""]));
  let totalPoints = 0;
  const gradedRows = [];

  for (const q of questions as any[]) {
    const typed = answerMap.get(String(q.id)) || "";
    const expectedVariants = new Set<string>();
    for (const expected of (q.accepted_answers_snapshot || [])) {
      for (const v of variantsFromExpected(String(expected))) expectedVariants.add(v);
    }
    const points = scoreAgainstExpected(typed, expectedVariants);
    totalPoints += points;
    gradedRows.push({
      session_id: session.id,
      question_id: q.id,
      response_text: typed,
      points,
      updated_at: new Date().toISOString(),
    });
  }

  if (gradedRows.length) {
    const { error } = await admin
      .from("practice_answers")
      .upsert(gradedRows, { onConflict: "session_id,question_id" });
    if (error) throw error;
  }

  const max = questions.length;
  const percent = max ? Math.round((totalPoints / max) * 1000) / 10 : 0;
  const upperPoints = pointsForPercent(percent);
  const grade = gradeForPoints(upperPoints);

  const { error: updateError } = await admin
    .from("practice_sessions")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      raw_points: totalPoints,
      max_points: max,
      percent,
      grade_text: grade,
      upper_school_points: upperPoints,
    })
    .eq("id", session.id);
  if (updateError) throw updateError;
}

async function buildResult(admin: any, session: any) {
  const { data: fresh, error: freshError } = await admin
    .from("practice_sessions")
    .select("*")
    .eq("id", session.id)
    .single();
  if (freshError) throw freshError;

  const questions = await getQuestions(admin, fresh.id, true);
  const { data: answerRows, error: answerError } = await admin
    .from("practice_answers")
    .select("question_id,response_text,points")
    .eq("session_id", fresh.id);
  if (answerError) throw answerError;
  const answerMap = new Map((answerRows || []).map((a: any) => [String(a.question_id), a]));

  return {
    submittedAt: fresh.submitted_at,
    config: {
      unitKeys: fresh.unit_keys || [],
      folderIds: fresh.folder_ids || [],
      questionCount: fresh.question_count,
      durationMinutes: fresh.duration_minutes,
    },
    summary: {
      rawPoints: Number(fresh.raw_points || 0),
      maxPoints: Number(fresh.max_points || 0),
      percent: Number(fresh.percent || 0),
      gradeText: fresh.grade_text || "—",
      upperSchoolPoints: Number(fresh.upper_school_points || 0),
    },
    corrections: (questions as any[]).map((q: any) => {
      const a: any = answerMap.get(String(q.id)) || {};
      return {
        position: q.position,
        sourceText: q.source_snapshot,
        responseText: a.response_text || "",
        acceptedAnswers: q.accepted_answers_snapshot || [],
        points: Number(a.points || 0),
      };
    }),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const admin = getAdmin();
    const body = await req.json();
    const action = String(body?.action || "");

    if (action === "catalog") {
      const { data: units, error: unitError } = await admin
        .from("units")
        .select("id,unit_key,title,sort_order,course_key")
        .order("sort_order");
      if (unitError) throw unitError;

      const { data: folders, error: folderError } = await admin
        .from("vocab_folders")
        .select("id,unit_id,title,sort_order,quarter_title,quarter_order,active")
        .eq("active", true)
        .order("unit_id")
        .order("sort_order");
      if (folderError) throw folderError;

      const vocab = await fetchAllRows(() => admin
        .from("vocabulary")
        .select("id,unit_id")
        .eq("active", true));

      const activeIds = new Set((vocab || []).map((v: any) => String(v.id)));
      const unitCounts = new Map<number, number>();
      for (const v of (vocab || [])) unitCounts.set(v.unit_id, (unitCounts.get(v.unit_id) || 0) + 1);

      const memberships = await fetchAllRows(() => admin
        .from("vocabulary_folders")
        .select("vocabulary_id,folder_id"));
      const folderCounts = new Map<number, number>();
      for (const m of (memberships || [])) {
        if (!activeIds.has(String(m.vocabulary_id))) continue;
        folderCounts.set(m.folder_id, (folderCounts.get(m.folder_id) || 0) + 1);
      }

      return response({
        ok: true,
        units: (units || []).map((u: any) => ({
          id: u.id,
          unitKey: u.unit_key,
          title: u.title,
          courseKey: u.course_key || "EF",
          sortOrder: u.sort_order,
          count: unitCounts.get(u.id) || 0,
          folders: (folders || [])
            .filter((f: any) => f.unit_id === u.id)
            .map((f: any) => ({
              id: f.id,
              title: f.title,
              sortOrder: f.sort_order,
              quarterTitle: f.quarter_title,
              quarterOrder: f.quarter_order,
              count: folderCounts.get(f.id) || 0,
            })),
        })),
      });
    }

    if (action === "vocab_list") {
      const unitKeys = Array.isArray(body?.unitKeys)
        ? [...new Set(body.unitKeys.map((x: unknown) => String(x).trim()).filter(Boolean))]
        : [];
      const folderIds = Array.isArray(body?.folderIds)
        ? [...new Set(body.folderIds.map((x: unknown) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0))]
        : [];
      if (!unitKeys.length && !folderIds.length) {
        return response({ error: "Bitte mindestens eine Unidad oder einen Unterordner auswählen." }, 400);
      }

      const candidates = new Map<string, any>();
      let selectedUnitIds: number[] = [];
      if (unitKeys.length) {
        const { data: selectedUnits, error: selectedUnitsError } = await admin
          .from("units")
          .select("id,unit_key")
          .in("unit_key", unitKeys);
        if (selectedUnitsError) throw selectedUnitsError;
        selectedUnitIds = (selectedUnits || []).map((u: any) => Number(u.id));
        if (selectedUnitIds.length) {
          const rows = await fetchAllRows(() => admin
            .from("vocabulary")
            .select("id,unit_id,source_text,accepted_answers")
            .eq("active", true)
            .in("unit_id", selectedUnitIds));
          for (const row of (rows || [])) candidates.set(String(row.id), row);
        }
      }

      if (folderIds.length) {
        const maps = await fetchAllRows(() => admin
          .from("vocabulary_folders")
          .select("vocabulary_id")
          .in("folder_id", folderIds));
        const vocabularyIds = [...new Set((maps || []).map((m: any) => Number(m.vocabulary_id)))];
        if (vocabularyIds.length) {
          const rows = await fetchRowsByIdChunks(vocabularyIds, chunk => admin
            .from("vocabulary")
            .select("id,unit_id,source_text,accepted_answers")
            .eq("active", true)
            .in("id", chunk));
          for (const row of (rows || [])) candidates.set(String(row.id), row);
        }
      }

      const rows = [...candidates.values()];
      if (!rows.length) return response({ ok: true, vocabulary: [] });
      const vocabularyIds = rows.map((row: any) => Number(row.id));
      const allUnitIds = [...new Set(rows.map((row: any) => Number(row.unit_id)))];
      const { data: units, error: unitsError } = await admin
        .from("units")
        .select("id,unit_key,title,course_key")
        .in("id", allUnitIds);
      if (unitsError) throw unitsError;
      const unitById = new Map((units || []).map((u: any) => [Number(u.id), u]));

      const memberships = await fetchRowsByIdChunks(vocabularyIds, chunk => admin
        .from("vocabulary_folders")
        .select("vocabulary_id,folder_id")
        .in("vocabulary_id", chunk));
      const folderIdsByVocab = new Map<string, number[]>();
      for (const membership of (memberships || [])) {
        const key = String(membership.vocabulary_id);
        if (!folderIdsByVocab.has(key)) folderIdsByVocab.set(key, []);
        folderIdsByVocab.get(key)!.push(Number(membership.folder_id));
      }

      const allFolderIds = [...new Set([...folderIdsByVocab.values()].flat())];
      const { data: folders, error: foldersError } = allFolderIds.length
        ? await admin.from("vocab_folders").select("id,title,quarter_title,quarter_order,sort_order").in("id", allFolderIds).eq("active", true)
        : { data: [], error: null };
      if (foldersError) throw foldersError;
      const folderById = new Map((folders || []).map((f: any) => [Number(f.id), f]));

      rows.sort((a: any, b: any) =>
        Number(a.unit_id) - Number(b.unit_id) ||
        String(a.source_text || "").localeCompare(String(b.source_text || ""), "de")
      );
      return response({
        ok: true,
        vocabulary: rows.map((row: any) => {
          const unit = unitById.get(Number(row.unit_id));
          const folderIdsForRow = folderIdsByVocab.get(String(row.id)) || [];
          const displayFolderIds = selectedUnitIds.includes(Number(row.unit_id))
            ? folderIdsForRow
            : folderIdsForRow.filter((id: number) => folderIds.includes(id));
          return {
            sourceText: row.source_text,
            acceptedAnswers: Array.isArray(row.accepted_answers) ? row.accepted_answers : [],
            courseKey: unit?.course_key || "EF",
            unitTitle: unit?.title || unit?.unit_key || "",
            folderGroups: displayFolderIds
              .map((id: number) => folderById.get(id))
              .filter(Boolean)
              .map((folder: any) => ({
                title: folder.title,
                quarterTitle: folder.quarter_title || "",
                quarterOrder: folder.quarter_order || null,
                sortOrder: folder.sort_order || 0,
              })),
            folderIds: displayFolderIds,
            folderTitles: displayFolderIds.map((id: number) => folderById.get(id)?.title).filter(Boolean),
          };
        }),
      });
    }

    if (action === "start") {
      const unitKeys = Array.isArray(body?.unitKeys)
        ? [...new Set(body.unitKeys.map((x: unknown) => String(x).trim()).filter(Boolean))]
        : [];
      const folderIds = Array.isArray(body?.folderIds)
        ? [...new Set(body.folderIds.map((x: unknown) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0))]
        : [];
      const questionCount = Number(body?.questionCount);
      const durationMinutes = Number(body?.durationMinutes);

      if (!unitKeys.length && !folderIds.length) return response({ error: "Bitte mindestens einen Vokabelbereich auswählen." }, 400);
      if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 500) {
        return response({ error: "Die Anzahl der Vokabeln muss zwischen 1 und 500 liegen." }, 400);
      }
      if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 300) {
        return response({ error: "Die Zeit muss zwischen 1 und 300 Minuten liegen." }, 400);
      }

      const candidates = new Map<string, any>();

      if (unitKeys.length) {
        const { data: selectedUnits, error: selectedUnitsError } = await admin
          .from("units")
          .select("id,unit_key")
          .in("unit_key", unitKeys);
        if (selectedUnitsError) throw selectedUnitsError;
        const unitIds = (selectedUnits || []).map((u: any) => u.id);
        if (unitIds.length) {
          const rows = await fetchAllRows(() => admin
            .from("vocabulary")
            .select("id,source_text,accepted_answers")
            .eq("active", true)
            .in("unit_id", unitIds));
          for (const v of (rows || [])) candidates.set(String(v.id), v);
        }
      }

      if (folderIds.length) {
        const maps = await fetchAllRows(() => admin
          .from("vocabulary_folders")
          .select("vocabulary_id,folder_id")
          .in("folder_id", folderIds));
        const vocabIds = [...new Set((maps || []).map((m: any) => Number(m.vocabulary_id)))];
        if (vocabIds.length) {
          const rows = await fetchRowsByIdChunks(vocabIds, chunk => admin
            .from("vocabulary")
            .select("id,source_text,accepted_answers")
            .eq("active", true)
            .in("id", chunk));
          for (const v of (rows || [])) candidates.set(String(v.id), v);
        }
      }

      const pool = [...candidates.values()];
      if (questionCount > pool.length) {
        return response({
          error: "Für diese Auswahl stehen nur " + pool.length + " unterschiedliche Vokabeln zur Verfügung.",
          available: pool.length,
        }, 400);
      }

      shuffle(pool);
      const chosen = pool.slice(0, questionCount);
      const deadline = new Date(Date.now() + durationMinutes * 60000).toISOString();

      const { data: session, error: sessionError } = await admin
        .from("practice_sessions")
        .insert({
          deadline_at: deadline,
          duration_minutes: durationMinutes,
          question_count: questionCount,
          unit_keys: unitKeys,
          folder_ids: folderIds,
          max_points: questionCount,
        })
        .select("id,access_token,deadline_at")
        .single();
      if (sessionError) throw sessionError;

      const questionRows = chosen.map((v: any, i: number) => ({
        session_id: session.id,
        vocabulary_id: v.id,
        position: i + 1,
        source_snapshot: v.source_text,
        accepted_answers_snapshot: v.accepted_answers,
      }));

      const { data: insertedQuestions, error: questionError } = await admin
        .from("practice_questions")
        .insert(questionRows)
        .select("id,position,source_snapshot");
      if (questionError) {
        await admin.from("practice_sessions").delete().eq("id", session.id);
        throw questionError;
      }

      return response({
        ok: true,
        accessToken: session.access_token,
        deadlineAt: session.deadline_at,
        config: { unitKeys, folderIds, questionCount, durationMinutes },
        questions: (insertedQuestions || []).sort((a: any,b: any) => a.position - b.position),
        savedAnswers: [],
      });
    }

    if (action === "session") {
      const token = String(body?.accessToken || "").trim();
      if (!token) return response({ error: "Sitzung fehlt." }, 401);
      const session = await getSession(admin, token);
      if (!session) return response({ error: "Sitzung nicht gefunden." }, 404);

      if (session.status === "submitted") {
        return response({ ok: true, submitted: true, result: await buildResult(admin, session) });
      }
      if (Date.now() >= new Date(session.deadline_at).getTime()) {
        await finalize(admin, session);
        return response({ ok: true, submitted: true, expired: true, result: await buildResult(admin, session) });
      }

      const questions = await getQuestions(admin, session.id, false);
      const { data: saved, error: savedError } = await admin
        .from("practice_answers")
        .select("question_id,response_text")
        .eq("session_id", session.id);
      if (savedError) throw savedError;

      return response({
        ok: true,
        accessToken: token,
        deadlineAt: session.deadline_at,
        config: {
          unitKeys: session.unit_keys || [],
          folderIds: session.folder_ids || [],
          questionCount: session.question_count,
          durationMinutes: session.duration_minutes,
        },
        questions,
        savedAnswers: saved || [],
      });
    }

    if (action === "save") {
      const token = String(body?.accessToken || "").trim();
      const session = await getSession(admin, token);
      if (!session) return response({ error: "Sitzung nicht gefunden." }, 404);
      if (session.status === "submitted") return response({ ok: true, submitted: true, result: await buildResult(admin, session) });

      await saveAnswers(admin, session, body?.answers || []);
      if (Date.now() >= new Date(session.deadline_at).getTime()) {
        await finalize(admin, session);
        return response({ ok: true, submitted: true, expired: true, result: await buildResult(admin, session) });
      }
      return response({ ok: true, savedAt: new Date().toISOString() });
    }

    if (action === "submit") {
      const token = String(body?.accessToken || "").trim();
      const session = await getSession(admin, token);
      if (!session) return response({ error: "Sitzung nicht gefunden." }, 404);
      if (session.status === "submitted") return response({ ok: true, submitted: true, result: await buildResult(admin, session) });

      await saveAnswers(admin, session, body?.answers || []);
      await finalize(admin, session);
      return response({ ok: true, submitted: true, result: await buildResult(admin, session) });
    }

    return response({ error: "Unbekannte Aktion." }, 400);
  } catch (err) {
    console.error(err);
    return response({ error: "Die Testsimulation konnte gerade nicht verarbeitet werden." }, 500);
  }
});
