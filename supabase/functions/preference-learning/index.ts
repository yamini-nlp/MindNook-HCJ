import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIN_FEEDBACK_EVENTS = 10;
const FEEDBACK_WINDOW = 20;
const STEP = 0.02;

const BOUNDS = {
  w_task: { min: 0.2, max: 0.6 },
  w_safety: { min: 0.2, max: 0.6 },
  lambda_privacy: { min: 0.05, max: 0.3 },
  lambda_autonomy: { min: 0.05, max: 0.3 },
  cfp_weight: { min: 0.15, max: 0.85 },
  cfn_weight: { min: 0.15, max: 0.85 },
};

const DEFAULT_WEIGHTS = {
  w_task: 0.4,
  w_safety: 0.35,
  lambda_privacy: 0.15,
  lambda_autonomy: 0.10,
  cfp_weight: 0.4,
  cfn_weight: 0.6,
};

const OVER_INTERVENTION_ACTIONS = new Set(["intervene", "support"]);
const UNDER_INTERVENTION_ACTIONS = new Set(["affirm", "reflect"]);

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface FeedbackRow {
  action: string | null;
  rating: string | null;
  created_at: string;
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

    let body: { revert?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    if (body.revert) {
      const { error: revertError } = await adminClient
        .from("user_preferences")
        .update({ ...DEFAULT_WEIGHTS, weights_last_adjusted_at: null })
        .eq("user_id", userId);
      if (revertError) {
        return jsonResponse({ error: "Failed to revert weights" }, 500);
      }
      return jsonResponse({ success: true, reverted: true, weights: DEFAULT_WEIGHTS });
    }

    const { data: feedbackRows, error: feedbackError } = await adminClient
      .from("action_feedback")
      .select("action, rating, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(FEEDBACK_WINDOW);

    if (feedbackError) {
      return jsonResponse({ error: "Failed to load feedback" }, 500);
    }

    const events: FeedbackRow[] = feedbackRows ?? [];
    if (events.length < MIN_FEEDBACK_EVENTS) {
      return jsonResponse({
        success: true,
        adjusted: false,
        reason: "insufficient_feedback",
        feedback_count: events.length,
        required: MIN_FEEDBACK_EVENTS,
      });
    }

    let overInterventionComplaints = 0;
    let underInterventionComplaints = 0;
    events.forEach((row) => {
      if (row.rating !== "down" || !row.action) return;
      if (OVER_INTERVENTION_ACTIONS.has(row.action)) overInterventionComplaints++;
      else if (UNDER_INTERVENTION_ACTIONS.has(row.action)) underInterventionComplaints++;
    });

    if (overInterventionComplaints === 0 && underInterventionComplaints === 0) {
      return jsonResponse({
        success: true,
        adjusted: false,
        reason: "no_directional_signal",
        feedback_count: events.length,
      });
    }

    const { data: prefsRow, error: prefsError } = await adminClient
      .from("user_preferences")
      .select("w_task, w_safety, lambda_privacy, lambda_autonomy, cfp_weight, cfn_weight")
      .eq("user_id", userId)
      .maybeSingle();

    if (prefsError) {
      return jsonResponse({ error: "Failed to load current preferences" }, 500);
    }

    const current = {
      w_task: prefsRow?.w_task ?? DEFAULT_WEIGHTS.w_task,
      w_safety: prefsRow?.w_safety ?? DEFAULT_WEIGHTS.w_safety,
      lambda_privacy: prefsRow?.lambda_privacy ?? DEFAULT_WEIGHTS.lambda_privacy,
      lambda_autonomy: prefsRow?.lambda_autonomy ?? DEFAULT_WEIGHTS.lambda_autonomy,
      cfp_weight: prefsRow?.cfp_weight ?? DEFAULT_WEIGHTS.cfp_weight,
      cfn_weight: prefsRow?.cfn_weight ?? DEFAULT_WEIGHTS.cfn_weight,
    };

    const next = { ...current };

    if (overInterventionComplaints > underInterventionComplaints) {
      next.lambda_autonomy = clamp(current.lambda_autonomy + STEP, BOUNDS.lambda_autonomy.min, BOUNDS.lambda_autonomy.max);
      next.cfn_weight = clamp(current.cfn_weight - STEP, BOUNDS.cfn_weight.min, BOUNDS.cfn_weight.max);
      next.w_safety = clamp(current.w_safety - STEP / 2, BOUNDS.w_safety.min, BOUNDS.w_safety.max);
    } else if (underInterventionComplaints > overInterventionComplaints) {
      next.cfn_weight = clamp(current.cfn_weight + STEP, BOUNDS.cfn_weight.min, BOUNDS.cfn_weight.max);
      next.w_safety = clamp(current.w_safety + STEP / 2, BOUNDS.w_safety.min, BOUNDS.w_safety.max);
      next.lambda_autonomy = clamp(current.lambda_autonomy - STEP / 2, BOUNDS.lambda_autonomy.min, BOUNDS.lambda_autonomy.max);
    }
    next.cfp_weight = clamp(1 - next.cfn_weight, BOUNDS.cfp_weight.min, BOUNDS.cfp_weight.max);
    next.w_task = clamp(1 - next.w_safety - next.lambda_privacy - next.lambda_autonomy, BOUNDS.w_task.min, BOUNDS.w_task.max);

    const changed = Object.keys(next).some(
      (key) => Math.abs((next as Record<string, number>)[key] - (current as Record<string, number>)[key]) > 1e-9
    );

    if (!changed) {
      return jsonResponse({ success: true, adjusted: false, reason: "already_at_bounds", feedback_count: events.length });
    }

    const { error: updateError } = await adminClient
      .from("user_preferences")
      .update({ ...next, weights_last_adjusted_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      return jsonResponse({ error: "Failed to save adjusted weights" }, 500);
    }

    return jsonResponse({
      success: true,
      adjusted: true,
      feedback_count: events.length,
      previous_weights: current,
      new_weights: next,
    });
  } catch (err) {
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});