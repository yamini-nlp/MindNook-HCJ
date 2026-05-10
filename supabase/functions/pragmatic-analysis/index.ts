import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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
    const { type, content, sentiment, user_goal, pragmatic_category, tone_type } = body;

    let prompt = "";

    if (type === "pragmatic") {
      prompt = `You are a pragmatic NLP analyzer for a reflective journaling system.

Journal Entry: "${content.replace(/"/g, "'").slice(0, 1000)}"
Layer 1 Detected Sentiment: ${sentiment}

Return ONLY valid JSON, no markdown:
{"category":"expression","confidence":0.85,"markers":["exclamatory tone","no question marks","conclusion-oriented"],"is_help_seeking":false,"tone_type":"cathartic"}

Rules:
category: assertion|question|expression|request|catharsis|help_seeking
tone_type: cathartic|venting|reflective|distressed|neutral
confidence: 0.0 to 1.0
markers: 2 to 5 short strings naming linguistic signals`;
    }

    if (type === "goal") {
      prompt = `You are a goal-alignment analyzer for a reflective journaling AI.

Journal Entry: "${content.replace(/"/g, "'").slice(0, 800)}"
User's Stated Goal: "${user_goal}"
Detected Sentiment: ${sentiment}
Pragmatic Category: ${pragmatic_category}
Tone Type: ${tone_type}

Return ONLY valid JSON, no markdown:
{"inferred_goal":"brief description of what the user is doing in this entry","goal_confidence":0.82,"alignment":"aligned","alignment_score":0.78,"goal_context":"one sentence explaining why"}

alignment must be: aligned|misaligned|ambiguous
alignment_score: 0.0 to 1.0
goal_confidence: 0.0 to 1.0`;
    }

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const groqData = await groqRes.json();
    if (!groqRes.ok) {
      return new Response(JSON.stringify({ error: groqData.error?.message || "Groq error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const text = groqData.choices?.[0]?.message?.content?.replace(/```json|```/g, "").trim() || "{}";
    const result = JSON.parse(text);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});