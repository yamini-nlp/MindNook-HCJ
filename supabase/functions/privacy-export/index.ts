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

    const [
      journalEntriesRes,
      userGoalsRes,
      userPreferencesRes,
      consentScopesRes,
      actionFeedbackRes,
      explanationFeedbackRes,
      temporalStateRes,
    ] = await Promise.all([
      userClient.from("journal_entries").select("*").eq("user_id", userId),
      userClient.from("user_goals").select("*").eq("user_id", userId),
      userClient.from("user_preferences").select("*").eq("user_id", userId),
      userClient.from("user_consent_scopes").select("*").eq("user_id", userId),
      userClient.from("action_feedback").select("*").eq("user_id", userId),
      userClient.from("explanation_feedback").select("*").eq("user_id", userId),
      userClient.from("user_temporal_state").select("*").eq("user_id", userId),
    ]);

    const firstError = [
      journalEntriesRes, userGoalsRes, userPreferencesRes,
      consentScopesRes, actionFeedbackRes, explanationFeedbackRes, temporalStateRes,
    ].find((r) => r.error);
    if (firstError?.error) {
      return jsonResponse({ error: "Failed to gather export data" }, 500);
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