import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CONFIRMATION_PHRASE = "DELETE MY DATA";
const FRESH_REAUTH_WINDOW_SECONDS = 5 * 60;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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

    let body: { confirmationPhrase?: string } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const typedPhraseOk = (body.confirmationPhrase || "").trim() === CONFIRMATION_PHRASE;

    let freshReauthOk = false;
    const payload = decodeJwtPayload(token);
    if (payload && typeof payload.iat === "number") {
      const ageSeconds = Date.now() / 1000 - payload.iat;
      freshReauthOk = ageSeconds >= 0 && ageSeconds <= FRESH_REAUTH_WINDOW_SECONDS;
    }

    if (!typedPhraseOk && !freshReauthOk) {
      return jsonResponse({
        error: "confirmation_required",
        message: `Type "${CONFIRMATION_PHRASE}" to confirm, or re-authenticate and retry within ${FRESH_REAUTH_WINDOW_SECONDS / 60} minutes.`,
      }, 400);
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const deletionResults: Record<string, number> = {};

    async function deleteByUser(table: string) {
      const { error, count } = await adminClient
        .from(table)
        .delete({ count: "exact" })
        .eq("user_id", userId);
      if (error) throw new Error(`Failed to delete from ${table}: ${error.message}`);
      deletionResults[table] = count ?? 0;
    }

    await deleteByUser("moderation_events");
    await deleteByUser("explanation_feedback");
    await deleteByUser("action_feedback");
    await deleteByUser("escalation_events");
    await deleteByUser("user_temporal_state");
    await deleteByUser("user_goals");
    await deleteByUser("journal_entries");

    return jsonResponse({
      success: true,
      user_id: userId,
      deleted: deletionResults,
      account_preserved: true,
    });
  } catch (err) {
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});