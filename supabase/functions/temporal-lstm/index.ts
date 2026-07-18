import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const HIDDEN_SIZE = 12;
const LABELS = ["stable", "declining", "improving", "cyclical", "stabilizing"];
const SEED = 1337;
const ATTENTION_WINDOW = 10;
const CLIP = 5;

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randMatrix(rows: number, cols: number, rng: () => number): number[][] {
  const scale = Math.sqrt(1 / cols);
  const m: number[][] = [];
  for (let i = 0; i < rows; i++) {
    const row: number[] = [];
    for (let j = 0; j < cols; j++) row.push((rng() * 2 - 1) * scale);
    m.push(row);
  }
  return m;
}

function zeros(n: number): number[] {
  return new Array(n).fill(0);
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function clipVec(v: number[]): number[] {
  return v.map((x) => Math.max(-CLIP, Math.min(CLIP, x)));
}

function matVec(W: number[][], x: number[]): number[] {
  return W.map((row) => row.reduce((acc, w, j) => acc + w * (x[j] ?? 0), 0));
}

function addVec(...vs: number[][]): number[] {
  const out = zeros(vs[0].length);
  for (const v of vs) for (let i = 0; i < v.length; i++) out[i] += v[i];
  return out;
}

function elemMul(a: number[], b: number[]): number[] {
  return a.map((v, i) => v * b[i]);
}

function applyFn(v: number[], fn: (x: number) => number): number[] {
  return v.map(fn);
}

interface LSTMWeights {
  Wf: number[][]; Uf: number[][]; bf: number[];
  Wi: number[][]; Ui: number[][]; bi: number[];
  Wc: number[][]; Uc: number[][]; bc: number[];
  Wo: number[][]; Uo: number[][]; bo: number[];
  Wclass: number[][]; bclass: number[];
}

function buildWeights(): LSTMWeights {
  const rng = mulberry32(SEED);
  return {
    Wf: randMatrix(HIDDEN_SIZE, 1, rng), Uf: randMatrix(HIDDEN_SIZE, HIDDEN_SIZE, rng), bf: zeros(HIDDEN_SIZE),
    Wi: randMatrix(HIDDEN_SIZE, 1, rng), Ui: randMatrix(HIDDEN_SIZE, HIDDEN_SIZE, rng), bi: zeros(HIDDEN_SIZE),
    Wc: randMatrix(HIDDEN_SIZE, 1, rng), Uc: randMatrix(HIDDEN_SIZE, HIDDEN_SIZE, rng), bc: zeros(HIDDEN_SIZE),
    Wo: randMatrix(HIDDEN_SIZE, 1, rng), Uo: randMatrix(HIDDEN_SIZE, HIDDEN_SIZE, rng), bo: zeros(HIDDEN_SIZE),
    Wclass: randMatrix(LABELS.length, HIDDEN_SIZE, rng), bclass: zeros(LABELS.length),
  };
}

const WEIGHTS = buildWeights();

function lstmStep(xScalar: number, hPrev: number[], cPrev: number[], w: LSTMWeights) {
  const x = [xScalar];
  const f = applyFn(addVec(matVec(w.Wf, x), matVec(w.Uf, hPrev), w.bf), sigmoid);
  const i = applyFn(addVec(matVec(w.Wi, x), matVec(w.Ui, hPrev), w.bi), sigmoid);
  const cTilde = applyFn(addVec(matVec(w.Wc, x), matVec(w.Uc, hPrev), w.bc), Math.tanh);
  const c = clipVec(addVec(elemMul(f, cPrev), elemMul(i, cTilde)));
  const o = applyFn(addVec(matVec(w.Wo, x), matVec(w.Uo, hPrev), w.bo), sigmoid);
  const h = clipVec(elemMul(o, applyFn(c, Math.tanh)));
  return { h, c };
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

function classify(h: number[], w: LSTMWeights) {
  const logits = addVec(matVec(w.Wclass, h), w.bclass);
  const probs = softmax(logits);
  const probabilities: Record<string, number> = {};
  LABELS.forEach((l, i) => (probabilities[l] = +probs[i].toFixed(4)));
  const label = LABELS[probs.indexOf(Math.max(...probs))];
  const direction = label === "improving" ? "up" : label === "declining" ? "down" : label === "stable" ? "neutral" : "mixed";
  return { label, direction, probabilities };
}

function normalizeSentiment(entry: any): number {
  if (entry.sentiment_score != null) return (entry.sentiment_score - 50) / 50;
  return 0;
}

function dotProduct(a: number[], b: number[]): number {
  return a.reduce((acc, v, i) => acc + v * b[i], 0);
}

function computeAttention(finalH: number[], w: LSTMWeights, historicalEntries: any[]) {
  if (!historicalEntries.length) return [];
  let h = zeros(HIDDEN_SIZE);
  let c = zeros(HIDDEN_SIZE);
  const trace: { entry: any; h: number[] }[] = [];
  for (const e of historicalEntries) {
    const step = lstmStep(normalizeSentiment(e), h, c, w);
    h = step.h;
    c = step.c;
    trace.push({ entry: e, h });
  }
  const scale = Math.sqrt(HIDDEN_SIZE);
  const scores = trace.map((t) => dotProduct(finalH, t.h) / scale);
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  const weights = exps.map((e) => e / sum);
  return trace
    .map((t, i) => ({
      entry_id: t.entry.id,
      timestamp: t.entry.created_at,
      score: t.entry.sentiment_score ?? null,
      weight: +weights[i].toFixed(4),
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { mode, sentiment_score, entry_id } = body;

    const { count } = await supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) < 2) {
      return new Response(JSON.stringify({
        label: "insufficient data", direction: "neutral", probabilities: {},
        attentionContributors: [], hiddenState: [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: stateRow } = await supabase
      .from("user_temporal_state")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    let hPrev: number[] = stateRow?.hidden_state ?? zeros(HIDDEN_SIZE);
    let cPrev: number[] = stateRow?.cell_state ?? zeros(HIDDEN_SIZE);

    let hCurrent = hPrev;
    let cCurrent = cPrev;

    if (mode === "update" && sentiment_score != null) {
      const normalized = (sentiment_score - 50) / 50;
      const step = lstmStep(normalized, hPrev, cPrev, WEIGHTS);
      hCurrent = step.h;
      cCurrent = step.c;

      await supabase.from("user_temporal_state").upsert({
        user_id: user.id,
        hidden_state: hCurrent,
        cell_state: cCurrent,
        last_entry_id: entry_id ?? null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    }

    const { label, direction, probabilities } = classify(hCurrent, WEIGHTS);

    const { data: recentEntries } = await supabase
      .from("journal_entries")
      .select("id,created_at,sentiment_score")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(ATTENTION_WINDOW);

    const attentionContributors = computeAttention(hCurrent, WEIGHTS, recentEntries ?? []);

    if (mode === "update" && entry_id) {
      await supabase
        .from("journal_entries")
        .update({
          layer3_temporal: { label, direction, method: "lstm" },
          layer3_probabilities: probabilities,
          layer3_attention: attentionContributors,
          layer3_method: "lstm",
        })
        .eq("id", entry_id)
        .eq("user_id", user.id);
    }

    return new Response(JSON.stringify({
      label, direction, probabilities, attentionContributors, hiddenState: hCurrent,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});