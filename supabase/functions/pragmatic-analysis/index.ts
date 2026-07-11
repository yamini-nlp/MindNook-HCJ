import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    "alignment": "aligned",
    "alignment_score": 0.78,
    "goal_context": "one sentence explaining why this entry aligns or misaligns with their goals"
  }
}

Rules for pragmatic.category: assertion|question|expression|request|catharsis|help_seeking
Rules for pragmatic.tone_type: cathartic|venting|reflective|distressed|neutral
Rules for goal.alignment: aligned|misaligned|ambiguous
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
      const Cfp = body.cfp_weight ?? 0.4;
      const Cfn = body.cfn_weight ?? 0.6;
      const tau = Cfp / (Cfp + Cfn);
      const sentimentScore_l = sentiment === 'Positive' ? 1 : sentiment === 'Negative' ? -1 : 0;
      const trendScore = l3Direction === 'up' ? 1 : l3Direction === 'down' ? -1 : 0;
      const goalScoreNorm = (goalScore - 50) / 50;
      const pragScore = l2.dominant === 'help-seeking' ? 1 : l2.dominant === 'question' ? 0.5 : 0;
      const rawUtility = (sentimentScore_l * Cfn) + (trendScore * 0.3) + (goalScoreNorm * 0.2) + (pragScore * Cfp);
      const utility = Math.max(-1, Math.min(1, rawUtility));
      const pIntervention = Math.max(0, Math.min(1, 0.5 - (sentimentScore_l * 0.3) - (trendScore * 0.2) - (goalScoreNorm * 0.1)));
      const shouldIntervene = pIntervention > tau;
      let action;
      if (utility >= 0.5) action = 'affirm';
      else if (utility >= 0.1) action = 'encourage';
      else if (utility >= -0.1) action = 'reflect';
      else if (utility >= -0.5 && !shouldIntervene) action = 'support';
      else action = 'intervene';
      const l5 = { utility: +utility.toFixed(3), action, tau: +tau.toFixed(2), pIntervention: +pIntervention.toFixed(3), shouldIntervene };

      const updatePayload: Record<string, unknown> = {
        layer2_pragmatic: pragData,
        layer4_goal: goalData,
        layer5_action: l5,
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
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});