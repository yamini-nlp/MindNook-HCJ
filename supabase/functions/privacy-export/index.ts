import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token || token === ANON_KEY) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const tables = [
      "journal_entries",
      "user_goals",
      "user_preferences",
      "user_consent_scopes",
      "action_feedback",
      "explanation_feedback",
      "user_temporal_state",
    ];

    const [
      journalEntriesRes,
      userGoalsRes,
      userPreferencesRes,
      consentScopesRes,
      actionFeedbackRes,
      explanationFeedbackRes,
      temporalStateRes,
    ] = await Promise.all(
      tables.map((table) => userClient.from(table).select("*").eq("user_id", userId))
    );

    const results = [
      journalEntriesRes, userGoalsRes, userPreferencesRes,
      consentScopesRes, actionFeedbackRes, explanationFeedbackRes, temporalStateRes,
    ];
    const firstErrorIndex = results.findIndex((r) => r.error);
    if (firstErrorIndex !== -1) {
      const failedTable = tables[firstErrorIndex];
      const dbMessage = results[firstErrorIndex].error?.message || "Unknown database error";
      console.error(`privacy-export: query failed for table "${failedTable}":`, dbMessage);
      return jsonResponse({ error: `Failed to gather export data (${failedTable}): ${dbMessage}` }, 500);
    }

    const exportPayload = {
      exported_at: new Date().toISOString(),
      user_id: userId,
      journal_entries: journalEntriesRes.data ?? [],
      user_goals: userGoalsRes.data ?? [],
      user_preferences: userPreferencesRes.data ?? [],
      consent_scopes: consentScopesRes.data ?? [],
      action_feedback: actionFeedbackRes.data ?? [],
      explanation_feedback: explanationFeedbackRes.data ?? [],
      temporal_state: temporalStateRes.data ?? [],
    };

    return jsonResponse(exportPayload, 200, {
      "Content-Disposition": `attachment; filename="mindnook-export-${userId}.json"`,
    });
  } catch (err) {
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});