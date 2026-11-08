
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

function randomCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => alphabet[b % alphabet.length]).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Nicht angemeldet." }, 401);
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}");
    const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    const publishableKey = publishableKeys.default || Deno.env.get("SUPABASE_ANON_KEY");
    const secretKey = secretKeys.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!publishableKey || !secretKey) {
      return json({ error: "Serverkonfiguration unvollständig." }, 500);
    }

    const userClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const admin = createClient(url, secretKey, {
      auth: { persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) {
      return json({ error: "Anmeldung ungültig." }, 401);
    }

    const { data: teacher, error: teacherError } = await admin
      .from("teacher_profiles")
      .select("approved, role, display_name")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (teacherError) throw teacherError;
    if (!teacher?.approved) {
      return json({ error: "Lehrerzugang ist noch nicht freigeschaltet." }, 403);
    }

    const body = await req.json();
    const unitKeys = Array.isArray(body.unitKeys)
      ? [...new Set(body.unitKeys.map((x: unknown) => String(x).trim()).filter(Boolean))]
      : [];
    const folderIds = Array.isArray(body.folderIds)
      ? [...new Set(body.folderIds.map((x: unknown) => Number(x)).filter((x: number) => Number.isInteger(x) && x > 0))]
      : [];
    const questionCount = Number(body.questionCount);
    const durationMinutes = Number(body.durationMinutes);
    const testDate = String(body.testDate || "");
    const title = String(body.title || "").trim();
    const courseId = String(body.courseId || "").trim();
    const quarterNumber = Number(body.quarterNumber);
    if (!courseId) return json({ error: "Bitte einen Kurs auswählen." }, 400);
    if (!Number.isInteger(quarterNumber) || quarterNumber < 1 || quarterNumber > 4) return json({ error: "Bitte ein Quartal von 1 bis 4 auswählen." }, 400);
    const { data: course, error: courseError } = await admin
      .from("teacher_courses").select("id,name").eq("id",courseId).eq("owner_id",userData.user.id).eq("active",true).maybeSingle();
    if (courseError) throw courseError;
    if (!course) return json({ error: "Der ausgewählte Kurs ist nicht verfügbar." }, 400);

    if (!unitKeys.length && !folderIds.length) return json({ error: "Bitte mindestens eine Unidad oder einen Unterordner auswählen." }, 400);
    if (!Number.isInteger(questionCount) || questionCount < 1 || questionCount > 500) {
      return json({ error: "Die Anzahl der Vokabeln muss zwischen 1 und 500 liegen." }, 400);
    }
    if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 300) {
      return json({ error: "Die Bearbeitungszeit muss zwischen 1 und 300 Minuten liegen." }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(testDate)) {
      return json({ error: "Bitte ein gültiges Testdatum wählen." }, 400);
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const publicCode = randomCode(8);
      const { data: testId, error } = await admin.rpc("create_vocabulary_test_v2", {
        p_owner: userData.user.id,
        p_unit_keys: unitKeys,
        p_folder_ids: folderIds,
        p_question_count: questionCount,
        p_test_date: testDate,
        p_duration_minutes: durationMinutes,
        p_title: title,
        p_public_code: publicCode,
      });

      if (!error) {
        const { error: linkError } = await admin.from("tests")
          .update({ course_id: courseId, quarter_number: quarterNumber })
          .eq("id", testId).eq("owner_id", userData.user.id);
        if (linkError) {
          await admin.from("tests").delete().eq("id", testId).eq("owner_id", userData.user.id);
          throw linkError;
        }
        return json({
          ok: true,
          testId,
          publicCode,
          questionCount,
          durationMinutes,
          testDate,
          title: title || "Vokabeltest",
          courseId,
          courseName: course.name,
          quarterNumber,
          unitKeys,
          folderIds,
        });
      }

      const msg = error.message || "";
      if (msg.includes("NOT_ENOUGH_VOCAB:")) {
        const available = Number(msg.split("NOT_ENOUGH_VOCAB:")[1]?.match(/\d+/)?.[0] || 0);
        return json({
          error: `In der gewählten Auswahl stehen nur ${available} unterschiedliche Aufgaben zur Verfügung.`,
          available,
        }, 400);
      }
      if (msg.toLowerCase().includes("duplicate") && msg.toLowerCase().includes("public_code")) {
        continue;
      }
      throw error;
    }

    return json({ error: "Es konnte kein eindeutiger Testcode erzeugt werden. Bitte erneut versuchen." }, 500);
  } catch (err) {
    console.error(err);
    return json({ error: "Der Test konnte nicht erstellt werden." }, 500);
  }
});
