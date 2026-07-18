import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ACTIONS = ["affirm", "encourage", "reflect", "support", "intervene"];
const ACTION_TARGET: Record<string, number> = { affirm: 1, encourage: 0.5, reflect: 0, support: -0.5, intervene: -1 };
const PRIVACY_DEPTH: Record<string, number> = { affirm: 0, encourage: 0, reflect: 1, support: 2, intervene: 3 };
const AUTONOMY_WEIGHT: Record<string, number> = { affirm: 0, encourage: 0.1, reflect: 0.2, support: 0.5, intervene: 1 };

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

interface L1 { sentiment: string; positiveWordCount: number; negativeWordCount: number; }
interface L2 { dominant: string; distribution: Record<string, number>; }
interface L3 { direction: string; label: string; slope: number; }
interface L4 { score: number | null; label: string; }

function computeAppropriateness(action: string, l1: L1, l2: L2, l3: L3, l4: L4): number {
  const sentimentScore = l1.sentiment === "Positive" ? 1 : l1.sentiment === "Negative" ? -1 : 0;
  const trendScore = l3.direction === "up" ? 1 : l3.direction === "down" ? -1 : 0;
  const goalScore = l4.score != null ? (l4.score - 50) / 50 : 0;
  const pragScore = l2.dominant === "help-seeking" ? 1 : l2.dominant === "question" ? 0.5 : 0;
  const compositeSignal = clamp(sentimentScore * 0.4 + trendScore * 0.3 + goalScore * 0.2 + pragScore * 0.1, -1, 1);
  const target = ACTION_TARGET[action] ?? 0;
  return +clamp(1 - Math.abs(compositeSignal - target) / 2, 0, 1).toFixed(3);
}

function computeSafety(action: string, l1: L1, l3: L3, entryHistory: number[]): number {
  const recentLow = entryHistory.length >= 3 && entryHistory.slice(-3).every((s) => s < 35);
  const concerning = (l3.direction === "down" && l1.sentiment === "Negative") || recentLow;
  const gentleActions = ["support", "intervene"];
  const safety = concerning ? (gentleActions.includes(action) ? 1 : -1) : (action === "intervene" ? -0.3 : 0.2);
  return +clamp(safety, -1, 1).toFixed(3);
}

function computePrivacyCost(action: string, inferenceDepth: number): number {
  const base = PRIVACY_DEPTH[action] ?? 1;
  return +clamp((base + inferenceDepth) / 4, 0, 1).toFixed(3);
}

function computeAutonomyCost(action: string, userAutonomyPreference: number): number {
  const weight = AUTONOMY_WEIGHT[action] ?? 0.2;
  return +clamp(weight * userAutonomyPreference, 0, 1).toFixed(3);
}

interface UtilityWeights { w_task: number; w_safety: number; lambda_privacy: number; lambda_autonomy: number; }

function computeDecomposedUtility(action: string, l1: L1, l2: L2, l3: L3, l4: L4, entryHistory: number[], inferenceDepth: number, autonomyPreference: number, weights: UtilityWeights) {
  const appropriateness = computeAppropriateness(action, l1, l2, l3, l4);
  const safety = computeSafety(action, l1, l3, entryHistory);
  const privacyCost = computePrivacyCost(action, inferenceDepth);
  const autonomyCost = computeAutonomyCost(action, autonomyPreference);
  const rawUtility = weights.w_task * appropriateness + weights.w_safety * safety
    - weights.lambda_privacy * privacyCost - weights.lambda_autonomy * autonomyCost;
  const utility = +clamp(rawUtility, -1, 1).toFixed(3);
  return { utility, breakdown: { appropriateness, safety, privacyCost, autonomyCost } };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_KEY) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const body = await req.json();
    const { type, content, sentiment, user_goal, pragmatic_category, tone_type, goals, entry_id, sentiment_score } = body;

    if (type === "goal_clarification_response") {
      const { goal_id, answer, custom_text } = body;
      if (!goal_id || !answer) {
        return new Response(JSON.stringify({ error: "Missing required fields: goal_id and answer" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
      if (!["yes", "not_quite", "custom"].includes(answer)) {
        return new Response(JSON.stringify({ error: "Invalid answer. Must be yes, not_quite, or custom." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const { data: goalRow, error: goalFetchError } = await supabase
        .from("user_goals")
        .select("id,text,confirmation_count,rejection_count")
        .eq("id", goal_id)
        .eq("user_id", user.id)
        .single();
      if (goalFetchError || !goalRow) {
        return new Response(JSON.stringify({ error: "Goal not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (answer === "yes") {
        const newConfirmCount = (goalRow.confirmation_count || 0) + 1;
        const recalibratedConfidence = clamp(0.6 + newConfirmCount * 0.1, 0, 1);
        await supabase.from("user_goals").update({
          status: "active",
          confidence: recalibratedConfidence,
          confirmation_count: newConfirmCount,
          updated_at: new Date().toISOString(),
        }).eq("id", goal_id).eq("user_id", user.id);
      } else if (answer === "not_quite") {
        const newRejectCount = (goalRow.rejection_count || 0) + 1;
        await supabase.from("user_goals").update({
          status: "rejected",
          rejection_count: newRejectCount,
          updated_at: new Date().toISOString(),
        }).eq("id", goal_id).eq("user_id", user.id);
      } else {
        const trimmedCustom = String(custom_text || "").trim().slice(0, 200);
        if (!trimmedCustom) {
          return new Response(JSON.stringify({ error: "Missing custom_text for custom answer" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
          });
        }
        await supabase.from("user_goals").update({
          status: "rejected",
          rejection_count: (goalRow.rejection_count || 0) + 1,
          updated_at: new Date().toISOString(),
        }).eq("id", goal_id).eq("user_id", user.id);
        await supabase.from("user_goals").insert([{
          user_id: user.id, text: trimmedCustom, type: "explicit", confidence: 1.0, source: "onboarding", status: "active",
        }]);
      }

      return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!type || !content || typeof content !== "string" || !content.trim()) {
      return new Response(JSON.stringify({ error: "Missing required fields: type and content" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    let prompt = "";

    if (type === "combined") {
      const goalsText = Array.isArray(goals) && goals.length > 0 ? goals.join(", ") : "general self-reflection";
      const sentScoreHint = sentiment_score != null ? ` Numeric sentiment score: ${sentiment_score}/100.` : "";
      prompt = `You are a pragmatic NLP and goal-alignment analyzer for a reflective journaling system.

Journal Entry: "${content.replace(/"/g, "'").slice(0, 1000)}"
Detected Sentiment: ${sentiment}${sentScoreHint}
User Journaling Goals: ${goalsText}

Return ONLY valid JSON, no markdown, no extra text:
{
  "pragmatic": {
    "category": "expression",
    "confidence": 0.85,
    "markers": ["exclamatory tone", "no question marks", "conclusion-oriented"],
    "is_help_seeking": false,
    "tone_type": "cathartic",
    "dominant": "expression",
    "distribution": {
      "assertion": 20,
      "expression": 60,
      "helpSeeking": 10,
      "question": 10
    }
  },
  "goal": {
    "inferred_goal": "brief description of what the user is doing in this entry",
    "goal_confidence": 0.82,
    "goal_type": "explicit",
    "alignment": "aligned",
    "alignment_score": 0.78,
    "goal_context": "one sentence explaining why this entry aligns or misaligns with their goals"
  }
}

Rules for pragmatic.category: assertion|question|expression|request|catharsis|help_seeking
Rules for pragmatic.tone_type: cathartic|venting|reflective|distressed|neutral
Rules for goal.alignment: aligned|misaligned|ambiguous
Rules for goal.goal_type: use "explicit" if the entry clearly matches one of the user's stated goals, "implicit" if it suggests a goal the user has not stated but goal_confidence must then reflect how uncertain that inference is, "meta" if the entry is about the user's goals or journaling practice itself
All scores and confidence values must be between 0.0 and 1.0
distribution values must be integers that sum to 100`;
    }

    if (type === "pragmatic") {
      prompt = `You are a pragmatic NLP analyzer for a reflective journaling system.

Journal Entry: "${content.replace(/"/g, "'").slice(0, 1000)}"
Detected Sentiment: ${sentiment}

Return ONLY valid JSON, no markdown:
{"category":"expression","confidence":0.85,"markers":["exclamatory tone","no question marks","conclusion-oriented"],"is_help_seeking":false,"tone_type":"cathartic","dominant":"expression","distribution":{"assertion":20,"expression":60,"helpSeeking":10,"question":10}}

Rules:
category: assertion|question|expression|request|catharsis|help_seeking
tone_type: cathartic|venting|reflective|distressed|neutral
confidence: 0.0 to 1.0
markers: 2 to 5 short strings naming linguistic signals
distribution values must be integers summing to 100`;
    }

    if (type === "goal") {
      prompt = `You are a goal-alignment analyzer for a reflective journaling AI.

Journal Entry: "${content.replace(/"/g, "'").slice(0, 800)}"
User's Stated Goal: "${user_goal}"
Detected Sentiment: ${sentiment}
Communication Category: ${pragmatic_category}
Tone Type: ${tone_type}

Return ONLY valid JSON, no markdown:
{"inferred_goal":"brief description of what the user is doing in this entry","goal_confidence":0.82,"alignment":"aligned","alignment_score":0.78,"goal_context":"one sentence explaining why"}

alignment must be: aligned|misaligned|ambiguous
alignment_score: 0.0 to 1.0
goal_confidence: 0.0 to 1.0`;
    }

    if (!prompt) {
      return new Response(JSON.stringify({ error: "Invalid type. Must be combined, pragmatic, or goal." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 600,
        temperature: 0.2,
        messages: [
          { role: "system", content: "You are a precise NLP analyzer. You ONLY return valid JSON. No markdown, no backticks, no explanations." },
          { role: "user", content: prompt }
        ]
      })
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) {
      return new Response(JSON.stringify({ error: groqData.error?.message || "Groq error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const raw = groqData.choices?.[0]?.message?.content?.replace(/```json|```/g, "").trim() || "{}";
    let result;
    try { result = JSON.parse(raw); }
    catch {
      return new Response(JSON.stringify({ error: "Failed to parse LLM response", raw }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (type === "combined" && result.pragmatic && result.goal && user?.id && entry_id) {
      const sentimentNumeric = sentiment_score != null ? sentiment_score : null;
      const pragData = result.pragmatic;
      const goalData = result.goal;
      const l1 = { sentiment, positiveWordCount: body.positive_word_count || 0, negativeWordCount: body.negative_word_count || 0 };
      const l2 = { dominant: pragData.dominant || 'assertion', distribution: pragData.distribution || {} };
      const l3Direction = body.trend_direction || 'neutral';
      const l3 = { direction: l3Direction, label: body.trend_label || 'stable', slope: body.trend_slope || 0 };
      const goalScore = goalData.alignment_score != null ? Math.round(goalData.alignment_score * 100) : 50;
      const l4 = { score: goalScore, label: goalData.alignment || 'ambiguous' };

      const tauGoal = clamp(body.tau_goal ?? 0.6, 0, 1);
      let lowConfidenceGoal: { id: string; text: string; confidence: number } | null = null;
      const inferredType = goalData.goal_type === "implicit" || goalData.goal_type === "meta" ? goalData.goal_type : null;
      if (inferredType && goalData.inferred_goal && goalData.goal_confidence != null) {
        const inferredText = String(goalData.inferred_goal).trim().slice(0, 200);
        if (inferredText) {
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
          const { data: recentRejections } = await supabase
            .from("user_goals")
            .select("id")
            .eq("user_id", user.id)
            .eq("status", "rejected")
            .ilike("text", inferredText)
            .gte("updated_at", fourteenDaysAgo)
            .limit(1);
          const recentlyRejected = !!(recentRejections && recentRejections.length > 0);

          if (!recentlyRejected) {
            const { data: existingGoal } = await supabase
              .from("user_goals")
              .select("id,confidence,status")
              .eq("user_id", user.id)
              .ilike("text", inferredText)
              .in("status", ["active", "pending_confirmation"])
              .limit(1);

            if (existingGoal && existingGoal.length > 0) {
              const g = existingGoal[0];
              if (g.status === "pending_confirmation" && g.confidence < tauGoal) {
                lowConfidenceGoal = { id: g.id, text: inferredText, confidence: g.confidence };
              }
            } else if (goalData.goal_confidence < tauGoal) {
              const { data: inserted } = await supabase
                .from("user_goals")
                .insert([{
                  user_id: user.id, text: inferredText, type: inferredType,
                  confidence: goalData.goal_confidence, source: "inferred", status: "pending_confirmation",
                }])
                .select("id")
                .single();
              if (inserted) {
                lowConfidenceGoal = { id: inserted.id, text: inferredText, confidence: goalData.goal_confidence };
              }
            }
          }
        }
      }
      const Cfp = body.cfp_weight ?? 0.4;
      const Cfn = body.cfn_weight ?? 0.6;
      const tau = Cfp / (Cfp + Cfn);
      const weights: UtilityWeights = {
        w_task: clamp(body.w_task ?? 0.4, 0, 1),
        w_safety: clamp(body.w_safety ?? 0.35, 0, 1),
        lambda_privacy: clamp(body.lambda_privacy ?? 0.15, 0, 1),
        lambda_autonomy: clamp(body.lambda_autonomy ?? 0.10, 0, 1),
      };
      if (weights.w_task + weights.w_safety > 1) {
        const scale = 1 / (weights.w_task + weights.w_safety);
        weights.w_task *= scale;
        weights.w_safety *= scale;
      }
      if (weights.lambda_privacy + weights.lambda_autonomy > 1) {
        const scale = 1 / (weights.lambda_privacy + weights.lambda_autonomy);
        weights.lambda_privacy *= scale;
        weights.lambda_autonomy *= scale;
      }
      const autonomyPreference = clamp(body.autonomy_preference ?? 0.5, 0, 1);
      const sentimentScore_l = sentiment === 'Positive' ? 1 : sentiment === 'Negative' ? -1 : 0;
      const trendScore = l3Direction === 'up' ? 1 : l3Direction === 'down' ? -1 : 0;
      const goalScoreNorm = (goalScore - 50) / 50;
      const pIntervention = Math.max(0, Math.min(1, 0.5 - (sentimentScore_l * 0.3) - (trendScore * 0.2) - (goalScoreNorm * 0.1)));
      const shouldIntervene = pIntervention > tau;

      let entryHistoryScores: number[] = [];
      const { data: historyRows } = await supabase
        .from("journal_entries")
        .select("sentiment_score,sentiment")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (historyRows) {
        entryHistoryScores = historyRows.map((r: any) => {
          if (r.sentiment_score != null) return r.sentiment_score;
          const s = (r.sentiment || "").toLowerCase();
          if (s.includes("positive")) return 75;
          if (s.includes("negative")) return 25;
          return 50;
        });
      }

      const candidateActions = shouldIntervene ? ACTIONS : ACTIONS.filter((a) => a !== "intervene");
      const results = candidateActions.map((action) => ({
        action,
        ...computeDecomposedUtility(action, l1, l2, l3, l4, entryHistoryScores, 0, autonomyPreference, weights),
      }));
      const best = results.reduce((a, b) => (b.utility > a.utility ? b : a));
      const l5 = {
        utility: best.utility,
        action: best.action,
        breakdown: best.breakdown,
        weights,
        tau: +tau.toFixed(2),
        pIntervention: +pIntervention.toFixed(3),
        shouldIntervene,
      };

      const updatePayload: Record<string, unknown> = {
        layer2_pragmatic: pragData,
        layer4_goal: goalData,
        layer5_action: l5,
        layer5_breakdown: l5.breakdown,
        layer_enrichment_status: 'complete',
      };
      if (sentimentNumeric != null) updatePayload.sentiment_score = sentimentNumeric;
      if (body.mu_user != null && sentimentNumeric != null) {
        updatePayload.sentiment_baseline_delta = +(sentimentNumeric - body.mu_user).toFixed(2);
      }

      await supabase
        .from("journal_entries")
        .update(updatePayload)
        .eq("id", entry_id)
        .eq("user_id", user.id);

      result.layer5_action = l5;
      result.goal.lowConfidenceGoal = lowConfidenceGoal;
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});