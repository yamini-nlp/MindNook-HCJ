import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { MODERATION_CATEGORIES, MODERATION_PROMPT_TEMPLATE } from "./moderation_prompt.ts";

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
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    let authedUserId: string | null = null;

    if (token && token !== ANON_KEY) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        ANON_KEY,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      authedUserId = user?.id ?? null;
    }

    const body = await req.json();
    const { text, mode, systemPrompt, history } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "Missing or invalid text field" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "moderate") {
      const entryId = body.entry_id ?? null;
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      );

      try {
        const prompt = MODERATION_PROMPT_TEMPLATE.replace("{{REPLY_TEXT}}", text.replace(/"/g, "'").slice(0, 3000));
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            max_tokens: 400,
            temperature: 0,
            messages: [
              { role: "system", content: "You are a precise safety classifier. You ONLY return valid JSON. No markdown, no backticks, no explanations." },
              { role: "user", content: prompt },
            ],
            response_format: { type: "json_object" },
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (authedUserId) {
            await serviceClient.from("moderation_events").insert({
              user_id: authedUserId, entry_id: entryId, category: "classifier_unavailable",
              confidence: 0, action_taken: "allowed",
            });
          }
          return new Response(JSON.stringify({ violations: [], safe: true, classifierUnavailable: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const raw = data.choices?.[0]?.message?.content?.replace(/```json|```/g, "").trim() || "{}";
        let parsed: { violations: { category: string; confidence: number }[]; safe: boolean };
        try {
          parsed = JSON.parse(raw);
        } catch {
          if (authedUserId) {
            await serviceClient.from("moderation_events").insert({
              user_id: authedUserId, entry_id: entryId, category: "classifier_unavailable",
              confidence: 0, action_taken: "allowed",
            });
          }
          return new Response(JSON.stringify({ violations: [], safe: true, classifierUnavailable: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const violations = (parsed.violations || []).filter((v) =>
          (MODERATION_CATEGORIES as readonly string[]).includes(v.category)
        );
        const safe = violations.every((v) => v.confidence < 0.5) && !!parsed.safe;

        if (authedUserId && violations.length > 0) {
          for (const v of violations) {
            await serviceClient.from("moderation_events").insert({
              user_id: authedUserId, entry_id: entryId, category: v.category,
              confidence: v.confidence, action_taken: safe ? "allowed" : "regenerated",
            });
          }
        }

        return new Response(JSON.stringify({ violations, safe }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (moderationErr) {
        if (authedUserId) {
          await serviceClient.from("moderation_events").insert({
            user_id: authedUserId, entry_id: entryId, category: "classifier_unavailable",
            confidence: 0, action_taken: "allowed",
          });
        }
        return new Response(JSON.stringify({ violations: [], safe: true, classifierUnavailable: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (mode === "chat") {
      const messages = [];
      if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
      if (Array.isArray(history)) {
        for (const h of history) {
          if (h.role && h.content) messages.push({ role: h.role, content: h.content });
        }
      }
      messages.push({ role: "user", content: text });

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "llama-3.3-70b-versatile", max_tokens: 1024, temperature: 0.7, messages }),
      });

      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.error?.message || "Groq error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const reply = data.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ reply }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (mode === "insights") {
      const insightPrompt = `You are a journaling analytics engine. You ONLY return valid JSON. No markdown, no backticks, no explanations.

Entries:
${text}

Return exactly this structure:
{"insights":[{"label":"string","text":"string","delta":"string"},{"label":"string","text":"string","delta":"string"},{"label":"string","text":"string","delta":"string"},{"label":"string","text":"string","delta":"string"}],"aiCards":[{"tag":"string","text":"string","footer":"string"},{"tag":"string","text":"string","footer":"string"},{"tag":"string","text":"string","footer":"string"},{"tag":"string","text":"string","footer":"string"}]}`;

      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 1200,
          temperature: 0.7,
          messages: [
            { role: "system", content: "You are a journaling analytics engine. You ONLY return valid JSON. No markdown, no backticks, no explanations." },
            { role: "user", content: insightPrompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.error?.message || "Groq error" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const raw = data.choices?.[0]?.message?.content || "{}";
      let parsed;
      try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
      catch { parsed = { insights: [], aiCards: [] }; }

      return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const analysisPrompt = `You are a journal entry analyzer. Analyze this journal entry and return ONLY valid JSON with no markdown, no backticks, no extra text.

Journal entry: "${text.replace(/"/g, "'").slice(0, 2000)}"

Return exactly this JSON:
{
  "sentiment": "Positive or Negative or Neutral",
  "wordCount": <number>,
  "sentenceCount": <number>,
  "uniqueWords": <number>,
  "mistakeCount": <number>,
  "readability": <number 0-100 Flesch score>,
  "positiveWordCount": <number>,
  "negativeWordCount": <number>,
  "neutralWordCount": <number>,
  "lexicalDiversity": <float 0-1>,
  "sentimentScore": <float 0-100 where 0=very negative 50=neutral 100=very positive>,
  "sentimentConfidence": <float 0-1>,
  "emotionWords": ["word1","word2","word3"],
  "repeatedWords": ["word1","word2"],
  "writingStyle": "Expressive or Conversational or Simple or Reflective or Descriptive",
  "grammarTrend": "Improving or Stable or Declining",
  "vocabularyTrend": "Improving or Developing or Stable",
  "progressSummary": "one sentence summary of writing quality",
  "moodLifter": "one uplifting sentence for the writer",
  "vocabularySuggestions": ["suggestion1","suggestion2","suggestion3"]
}`;

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 1000,
        temperature: 0.3,
        messages: [{ role: "user", content: analysisPrompt }],
        response_format: { type: "json_object" },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data.error?.message || "Groq error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = data.choices?.[0]?.message?.content || "{}";
    let parsed;
    try { parsed = JSON.parse(raw.replace(/```json|```/g, "").trim()); }
    catch {
      parsed = {
        sentiment: "Neutral",
        wordCount: text.split(/\s+/).length,
        sentenceCount: text.split(/[.!?]+/).filter(s => s.trim()).length,
        uniqueWords: new Set(text.toLowerCase().split(/\s+/)).size,
        mistakeCount: 0,
        readability: 50,
        positiveWordCount: 0,
        negativeWordCount: 0,
        neutralWordCount: 0,
        lexicalDiversity: 0.5,
        sentimentScore: 50,
        sentimentConfidence: 0.5,
        emotionWords: [],
        repeatedWords: [],
        writingStyle: "Conversational",
        grammarTrend: "Stable",
        vocabularyTrend: "Developing",
        progressSummary: "Entry analyzed.",
        moodLifter: "Every word you write is a step forward.",
        vocabularySuggestions: [],
      };
    }

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});