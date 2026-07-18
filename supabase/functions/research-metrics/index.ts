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

const ACTIONS = ["affirm", "encourage", "reflect", "support", "intervene"];

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

    let fromDate: string | null = null;
    let toDate: string | null = null;
    try {
      const body = await req.json();
      if (body && typeof body.from === "string") fromDate = body.from;
      if (body && typeof body.to === "string") toDate = body.to;
    } catch (_e) {
      fromDate = null;
      toDate = null;
    }
    const rangeEnd = toDate ? new Date(toDate) : new Date();
    const rangeStart = fromDate ? new Date(fromDate) : new Date(rangeEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
    const lookaheadEnd = new Date(rangeEnd.getTime() + 48 * 60 * 60 * 1000);

    const [entriesRes, actionFeedbackRes, explanationFeedbackRes, escalationRes] = await Promise.all([
      userClient
        .from("journal_entries")
        .select("id,created_at,layer5_action")
        .eq("user_id", userId)
        .gte("created_at", rangeStart.toISOString())
        .lte("created_at", rangeEnd.toISOString()),
      userClient
        .from("action_feedback")
        .select("entry_id,action,rating,created_at")
        .eq("user_id", userId)
        .gte("created_at", rangeStart.toISOString())
        .lte("created_at", rangeEnd.toISOString()),
      userClient
        .from("explanation_feedback")
        .select("entry_id,disagreed_layer,created_at")
        .eq("user_id", userId)
        .gte("created_at", rangeStart.toISOString())
        .lte("created_at", rangeEnd.toISOString()),
      userClient
        .from("escalation_events")
        .select("type,created_at")
        .eq("user_id", userId)
        .eq("type", "acute")
        .gte("created_at", rangeStart.toISOString())
        .lte("created_at", lookaheadEnd.toISOString()),
    ]);

    const firstError = [entriesRes, actionFeedbackRes, explanationFeedbackRes, escalationRes].find((r) => r.error);
    if (firstError?.error) {
      return jsonResponse({ error: "Failed to compute metrics" }, 500);
    }

    const entries = entriesRes.data ?? [];
    const actionFeedback = actionFeedbackRes.data ?? [];
    const explanationFeedback = explanationFeedbackRes.data ?? [];
    const escalations = escalationRes.data ?? [];

    const entryById = new Map<number | string, { id: number | string; created_at: string; layer5_action: Record<string, unknown> | null }>();
    for (const e of entries) entryById.set(e.id, e);

    function isEmpty(n: number) {
      return n === 0;
    }

    const feedbackOnInterveneOrSupport = actionFeedback.filter((f) => f.action === "intervene" || f.action === "support");
    const falseInterventionRate = isEmpty(feedbackOnInterveneOrSupport.length)
      ? null
      : feedbackOnInterveneOrSupport.filter((f) => f.rating === "down").length / feedbackOnInterveneOrSupport.length;

    const appropriatenessRate = isEmpty(actionFeedback.length)
      ? null
      : actionFeedback.filter((f) => f.rating === "up").length / actionFeedback.length;

    const actionCorrections = explanationFeedback.filter((f) => {
      if (f.disagreed_layer !== "action") return false;
      const entry = entryById.get(f.entry_id);
      const action = entry?.layer5_action && (entry.layer5_action as { action?: string }).action;
      return !!entry && action !== "intervene";
    });
    const missedSupportNumerator = actionCorrections.filter((f) => {
      const entry = entryById.get(f.entry_id);
      if (!entry) return false;
      const entryTime = new Date(entry.created_at).getTime();
      return escalations.some((esc) => {
        const escTime = new Date(esc.created_at).getTime();
        return escTime >= entryTime && escTime <= entryTime + 48 * 60 * 60 * 1000;
      });
    });
    const missedSupportRate = isEmpty(actionCorrections.length)
      ? null
      : missedSupportNumerator.length / actionCorrections.length;

    const shouldInterveneEntries = entries.filter((e) => {
      const l5 = e.layer5_action as { shouldIntervene?: boolean } | null;
      return !!l5 && l5.shouldIntervene === true;
    });
    const overriddenEntries = shouldInterveneEntries.filter((e) => {
      const l5 = e.layer5_action as { action?: string } | null;
      return !!l5 && l5.action !== "intervene";
    });
    const autonomyPreservationProxy = isEmpty(shouldInterveneEntries.length)
      ? null
      : overriddenEntries.length / shouldInterveneEntries.length;

    const actionDistribution: Record<string, number> = {};
    for (const a of ACTIONS) actionDistribution[a] = 0;
    for (const e of entries) {
      const l5 = e.layer5_action as { action?: string } | null;
      const action = l5 && l5.action;
      if (action && Object.prototype.hasOwnProperty.call(actionDistribution, action)) {
        actionDistribution[action] += 1;
      }
    }

    return jsonResponse({
      range: { from: rangeStart.toISOString(), to: rangeEnd.toISOString() },
      entry_count: entries.length,
      false_intervention_rate: falseInterventionRate,
      missed_support_rate: missedSupportRate,
      user_perceived_appropriateness: appropriatenessRate,
      autonomy_preservation_proxy: autonomyPreservationProxy,
      action_distribution: actionDistribution,
      sample_sizes: {
        action_feedback_intervene_support: feedbackOnInterveneOrSupport.length,
        action_feedback_total: actionFeedback.length,
        action_corrections_non_intervene: actionCorrections.length,
        should_intervene_entries: shouldInterveneEntries.length,
      },
    });
  } catch (_err) {
    return jsonResponse({ error: "Unexpected server error" }, 500);
  }
});