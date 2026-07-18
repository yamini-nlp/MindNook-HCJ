import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    let limit = 50;
    try {
      const body = await req.json();
      if (body && Number.isFinite(body.limit)) {
        limit = Math.max(1, Math.min(200, Math.floor(body.limit)));
      }
    } catch (_e) {
      limit = 50;
    }

    const { data: scopeRow } = await userClient
      .from("user_consent_scopes")
      .select("sentiment")
      .eq("user_id", userId)
      .maybeSingle();
    const sentimentAllowed = !scopeRow || scopeRow.sentiment !== false;

    const { data, error } = await userClient.rpc("get_user_history", { uid: userId, lim: limit });
    if (error) {
      return jsonResponse({ error: "Failed to load history" }, 500);
    }

    const history = (data || []).map((row: { x: number; t: string; s: number | null; m: Record<string, unknown>; entry: Record<string, unknown> }) => {
      const entry = row.entry || {};
      return {
        ...entry,
        x: row.x,
        t: row.t,
        s: sentimentAllowed ? row.s : null,
        m: row.m || {},
      };
    });

    return jsonResponse({ history });
  } catch (_err) {
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});