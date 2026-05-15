# MindNook — AI-Powered Journaling & NLP Analysis Platform

![Stack](https://img.shields.io/badge/Stack-HTML%20%2F%20JS%20%2F%20Deno-green) ![LLM](https://img.shields.io/badge/LLM-LLaMA%203.3%2070B-blue) ![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-orange) ![Status](https://img.shields.io/badge/Status-Live-brightgreen) ![Preprint](https://img.shields.io/badge/Preprint-TechRxiv%20%28IEEE%29-red)

A full-stack application that transforms personal writing into structured self-insight using large language models, a five-layer NLP framework, real-time sentiment analysis, and longitudinal mood tracking.

Built with HTML / CSS / JavaScript for the frontend and Deno Edge Functions on Supabase for the backend.

🌐 **Live Demo:** https://mindnook-hcj.vercel.app

📄 **Research Foundation:** This application is the prototype system described in the TechRxiv preprint (powered by IEEE).
Gabu Sai Yamini Devi. *"A System-Level Framework for Sentiment-Aware Reflective Writing Systems."* TechRxiv (IEEE Preprint), February 2026. DOI: [10.36227/techrxiv.177274130.07417144/v1](https://www.techrxiv.org/doi/full/10.36227/techrxiv.177274130.07417144/v1)

---

## 1️⃣ Problem Statement

Despite the well-documented cognitive and emotional benefits of reflective writing, most journaling tools remain passive — they store text but provide no analytical feedback. Users have no mechanism to:

- Track emotional trends across entries over time
- Identify recurring linguistic weaknesses in their writing
- Receive contextually grounded, intent-aware feedback based on their own content
- Align their journaling practice with self-stated personal goals

This project addresses the gap between passive journaling and active self-improvement by building a system that performs real-time sentiment classification, pragmatic speech-act analysis, temporal trend detection, goal alignment scoring, and utility-based response selection on free-form personal writing entries.

---

## 2️⃣ Why It Matters

**From an NLP research perspective:** Free-form journaling is an underexplored domain for applied language models. Unlike product reviews or news articles, journal entries are informal, emotionally rich, and highly personal — making them a meaningful testbed for sentiment analysis, pragmatic classification, and longitudinal affect modeling.

**From a systems perspective:** This project demonstrates the integration of serverless edge functions (Deno on Supabase) as a lightweight LLM gateway, decoupling the frontend from direct API key exposure while enabling low-latency inference via Groq's acceleration layer. All Groq calls are routed through the edge function — no API key is exposed in the browser.

**From a human-computer interaction perspective:** The design prioritizes psychological safety — the interface is distraction-free, feedback is non-judgmental, and the system never surfaces raw critique without pairing it with constructive alternatives. The five-layer utility action system selects a response directive (affirm, encourage, reflect, support, or intervene) calibrated to the user's current emotional state and trajectory. An ethical action filter enforces that the system never suggests clinical intervention without sufficient data, and the AI companion never provides medical diagnoses or clinical advice.

**From a research perspective:** This prototype operationalizes all five layers of the accompanying published framework and demonstrates practical application of schema-constrained LLM inference in a production-adjacent system.

---

## 3️⃣ Dataset

This application operates on user-generated journal entries as live inference input. No pre-existing benchmark dataset is used for runtime analysis.

For the client-side tone analysis module, two curated lexicons were hand-constructed with negation detection applied before lookup:

| Lexicon | Size | Coverage |
|---|---|---|
| Positive word set | ~150 lemmas | Joy, gratitude, calm, motivation, achievement, hope, resilience |
| Negative word set | ~150 lemmas | Sadness, anxiety, frustration, fear, defeat, burnout, isolation |

Stemming heuristics (suffix stripping: `-ing`, `-ed`, `-ly`, `-ness`, `-ful`, `-less`, `-s`) are applied before lookup to improve recall without requiring a full morphological analyzer. A negation word set (`not`, `never`, `no`, `without`, `hardly`, `cannot`, and common contractions) inverts polarity when a negation token appears within a 3-word window before an emotion word.

The LLM (LLaMA 3.3 70B via Groq) serves as the primary analysis engine for fields where rule-based approaches are insufficient: grammar correction, expression enrichment, narrative generation, and all five framework layer outputs. The LLM also returns a numeric `sentimentScore` (0–100 float) and `sentimentConfidence` (0–1 float) alongside the label, enabling the individual baseline deviation computation.

User onboarding data (stated journaling goals, initial emotional state, stress level, journaling frequency, AI insight sensitivity preference, and configurable Cfp/Cfn cost weights) is persisted to Supabase and used to personalise goal alignment scores and the utility-based action system across sessions and devices.

---

## 4️⃣ Methodology

The system implements a five-layer hybrid architecture combining deterministic client-side NLP with server-side LLM inference, with all layer outputs persisted to PostgreSQL for longitudinal analysis.

```
User Entry (Quill Rich Text Editor)
        │
        ▼
  [Client-Side NLP — personal_baseline.js]
  - Regex tokenization, unique word count, TTR
  - Lexicon-based tone classification with stemming + negation detection
  - Individual sentiment baseline: μuser = mean(sentiment_scores)
    Δpersonal = current_score − μuser (z-score normalised)
  - Layer 2: Pragmatic speech-act classification
    (assertion / expression / help-seeking / question)
  - Layer 3: Multi-window temporal trend regression
    Short window (3 entries) vs long window (10 entries) slope comparison
    Detects: improving / declining / stable / cyclical / stabilizing
    Exponential attention weights applied to historical scores
  - Layer 4: Goal alignment scoring against Supabase user_preferences
    (cross-device via syncGoalsFromSupabase(); localStorage as fallback)
  - Layer 5: Utility score + action selection under configurable Cfp/Cfn
    τ* = Cfp / (Cfp + Cfn) — threshold derived from user preference
    (affirm / encourage / reflect / support / intervene)
  - Ethical filter: applyEthicalFilter() downgrades intervene→support
    when insufficient history (<3 entries) or non-negative sentiment
        │
        ▼
  [Edge Function: analyze-journal — Deno / Supabase]
  - mode=analysis: returns 19-field structured analysis
    (sentiment label, sentimentScore 0–100, sentimentConfidence 0–1,
     word counts, lexical diversity, readability, writing style,
     grammar trend, vocabulary trend, emotion words, repeated words,
     mood lifter, vocabulary suggestions, progress summary)
  - mode=chat: routes Nook AI conversation using dynamic system prompt
    built from all 5 layers including ethical action directive
  - mode=insights: generates AI growth cards for dashboard
  - response_format: json_object enforced
  - User JWT validated on all non-anon requests
  - No Groq key in browser — all calls proxied here
        │
        ▼
  [Edge Function: pragmatic-analysis — Deno / Supabase]
  - type=combined: enriches Layer 2 (pragmatic) and
    Layer 4 (goal alignment) with server-side LLM analysis
  - Recomputes Layer 5 (utility action) server-side using enriched values
  - Writes enriched results back to journal_entries:
    layer2_pragmatic, layer4_goal, layer5_action,
    sentiment_score, sentiment_baseline_delta,
    layer_enrichment_status = 'complete'
  - Called asynchronously after save — non-blocking
  - Returns enriched layer5_action to client for immediate localStorage update
        │
        ▼
  [Supabase PostgreSQL Persistence]
  - Full 19-field analysis record stored per entry
  - All five layer outputs stored as JSONB columns
    (layer2_pragmatic, layer3_temporal, layer4_goal,
     layer5_action) with GIN indexes
  - sentiment_score FLOAT — numeric score per entry for baseline computation
  - sentiment_baseline_delta FLOAT — Δpersonal stored per entry
  - layer_enrichment_status TEXT — 'pending' on save, 'complete' post-enrichment
  - user_preferences stores goals, cfp_weight, cfn_weight,
    intervention_preference cross-device
  - RLS policies enforce strict per-user data isolation
```

Client-side and LLM-returned tone counts are blended (averaged) when both are non-zero, improving robustness against hallucinated counts from the model. The temporal trend classifier uses deterministic multi-window regression — no randomness — making results reproducible. The sentiment page (`sentiment.html`) fetches the enriched DB record by entry ID as its primary data source, falling back to localStorage only when the DB fetch fails, ensuring users see LLM-quality layer data rather than local heuristic results.

---

## 5️⃣ Model Architecture

### LLM Backbone

| Property | Value |
|---|---|
| Model | llama-3.3-70b-versatile |
| Provider | Groq (low-latency inference) |
| Deployment | Supabase Edge Function (Deno runtime) |
| Prompt Strategy | Single-turn, structured JSON schema injection |
| Output Format | `response_format: json_object` enforced |
| Temperature | 0.2–0.3 for analysis, 0.7 for chat and insights |

### Client-Side NLP Module — `personal_baseline.js`

Independent of the LLM, the frontend computes:

- **Type-Token Ratio (TTR)** — lexical diversity index (0–1)
- **Average sentence length** — structural complexity proxy
- **Tone word ratio** — positive / negative / neutral word counts via lexicon + stemming + negation detection
- **Individual sentiment baseline** — `computeSentimentBaseline()` computes μuser (mean sentiment score across entry history) and `computePersonalBaselineDelta()` returns the z-score deviation of the current entry from the user's personal mean
- **Repeated word detection** — frequency threshold flagging
- **Layer 2 Pragmatic Classification** — sentence-level speech act detection
- **Layer 3 Multi-Window Temporal Regression** — short-window vs long-window OLS slope comparison with exponential attention weights and stabilization detection
- **Layer 4 Goal Alignment** — weighted scoring against user-stated goals synced from Supabase (`syncGoalsFromSupabase()`)
- **Layer 5 Utility Score** — configurable Cfp/Cfn weights read from user preferences; τ* = Cfp/(Cfp+Cfn) determines intervention threshold; `applyEthicalFilter()` enforces safe action selection
- **Dynamic System Prompt** — `buildDynamicSystemPrompt()` incorporates all five layer outputs and ethical action directive into the Nook AI context

This dual-layer design ensures graceful degradation: if the LLM call fails, all five framework layers remain available from the client-side module with local fallback values.

### Five-Layer Framework Implementation

| Framework Layer | Description | Implementation |
|---|---|---|
| L1 — Sentiment Detection | Polarity classification + numeric score | Client lexicon + LLM (sentimentScore 0–100, sentimentConfidence 0–1 from analyze-journal) |
| L2 — Pragmatic Analysis | Speech act classification | Client `classifyPragmatic()` + async LLM enrichment via pragmatic-analysis |
| L3 — Temporal Pattern Recognition | Multi-window longitudinal trend | Client `classifyTemporalTrend()` — short/long window OLS + stabilization detection + attention weights |
| L4 — Goal Alignment | Scoring entry against user-stated goals | Client `computeGoalAlignment()` + Supabase `user_preferences` via `syncGoalsFromSupabase()` |
| L5 — Utility-Based Action Selection | Response directive under configurable asymmetric costs | Client `buildUtilityScore()` + `applyEthicalFilter()` + `buildDynamicSystemPrompt()` |

All five layer outputs are persisted to PostgreSQL JSONB columns per entry and used to shape the Nook AI system prompt dynamically.

### AI Insight Sensitivity (Configurable Cfp/Cfn)

During onboarding (Step 5), users select their preferred AI response sensitivity:

| Setting | Cfp | Cfn | τ* | Effect |
|---|---|---|---|---|
| Minimal | 0.6 | 0.4 | 0.60 | AI responds conservatively; rarely suggests support |
| Balanced (default) | 0.4 | 0.6 | 0.40 | Balanced intervention threshold |
| Proactive | 0.25 | 0.75 | 0.25 | AI proactively offers support on negative patterns |

These weights are saved to `user_preferences` in Supabase and synced to all devices.

---

## 6️⃣ Results

The following observations are drawn from manual evaluation across test entries.

| Metric | Observation |
|---|---|
| Sentiment Classification | Consistent with human judgment on clearly valenced entries; ambiguous entries trend toward Neutral |
| Individual Baseline Deviation | z-score deviation from μuser correctly identifies entries that are unusually positive or negative for that user |
| Grammar Correction | High precision on common errors; lower recall on stylistic issues |
| Vocabulary Enrichment | Suggestions are entry-specific — pulled from actual entry vocabulary, not generic lists |
| Narrative Generation | Story mode produces coherent 6–8 sentence arcs alternating with contextually matched quotes |
| Lexical Diversity (TTR) | Correlates meaningfully with perceived vocabulary richness across test entries |
| Temporal Trend | Multi-window regression produces stable, reproducible slope values; stabilization pattern correctly detected when recent slope flattens after earlier decline |
| Goal Alignment | Alignment score responds correctly to semantic content — stress-related entries score lower for stress-reduction goals |
| Nook AI Chat | Dynamic system prompt incorporating all 5 layers and ethical filter produces contextually appropriate, safe response tones |
| Analytics Page | All charts computed from real entry data — no hardcoded values |
| Inference Latency | Groq returns results within 1–2 seconds; pragmatic enrichment runs non-blocking post-save |
| Sentiment Page Data Quality | sentiment.html fetches enriched DB record as primary source — LLM-quality pragmatic and goal data displayed, not local heuristics |

---

## 7️⃣ Limitations

- **LLM Non-Determinism:** Repeated analysis of the same entry may return slightly different sentiment labels or mistake counts due to LLM temperature.
- **Lexicon Coverage:** The hand-curated word sets miss domain-specific or culturally nuanced expressions; a distributional lexicon (e.g., NRC Emotion Lexicon) would improve recall.
- **Grammar Checker Scope:** The LLM is not a dedicated grammar model and may miss subtle errors or flag stylistic choices incorrectly.
- **TTR Length Sensitivity:** Type-Token Ratio decreases as text length increases, making cross-entry comparisons unreliable at very different word counts; MATTR or MTLD would be more robust for long-form entries.
- **Pragmatic Enrichment Timing:** The LLM-enriched pragmatic result is written asynchronously — the sentiment page fetches from the DB but may briefly show local values if the enrichment has not yet completed before the page loads.
- **Multi-Window Regression vs LSTM:** Layer 3 uses multi-window OLS regression with attention weights rather than a trained LSTM sequence model. Non-linear patterns beyond stabilization detection are not captured; true recurrent temporal modeling remains future work.
- **No Population Norm Correction:** Individual baseline deviation is computed against the user's own history only. Cross-user population norms are not available in this single-user architecture.
- **Goal Inference from Explicit Signals Only:** Goal alignment uses only goals explicitly stated during onboarding. Implicit goal inference from writing patterns requires a trained model and is not implemented.

---

## 8️⃣ Future Work

- Replace TTR with Moving-Average TTR (MATTR) to control for text length sensitivity in longitudinal vocabulary comparisons
- Fine-tune a smaller model (e.g., DistilBERT) on journal-domain data for faster, more consistent Layer 1 classification with true probability distribution output P(ys|x)
- Implement LSTM-based temporal modeling for Layer 3 to replace multi-window regression with learned sequence representations and true attention weights
- Implicit goal inference from interaction history P(g|H; θ) using a trained goal-representation model
- Named entity and topic extraction to surface recurring themes across entries in the analytics dashboard
- Privacy-preserving personalization via federated learning and on-device processing
- Multi-language support extending the lexicon and prompt pipeline to non-English entries
- Real-time as-you-type sentiment feedback using debounced client-side analysis
- Export functionality for entries and analytics (PDF, CSV)
- A/B testing infrastructure to empirically compare sentiment-only vs full five-layer response systems

---

## 9️⃣ How to Run

### Prerequisites

- A Supabase account and project
- A Groq API key (free at [console.groq.com](https://console.groq.com))
- Supabase CLI installed (`npm install -g supabase`)
- VS Code with Live Server extension, or any static file server

### 1. Clone the repository

```bash
git clone https://github.com/yamireddy04/MindNook-HCJ.git
cd MindNook-HCJ
```

### 2. Set up the database

In your Supabase project SQL Editor, run these scripts in order:

**Script 1 — Create journal_entries table:**

```sql
CREATE TABLE journal_entries (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  content TEXT NOT NULL,
  sentiment TEXT,
  mood_lifter_content TEXT,
  word_count INT DEFAULT 0,
  sentence_count INT DEFAULT 0,
  mistake_count INT DEFAULT 0,
  lexical_feedback JSONB,
  unique_words INT DEFAULT 0,
  lexical_diversity FLOAT DEFAULT 0,
  readability TEXT,
  writing_style TEXT,
  grammar_trend TEXT,
  vocabulary_trend TEXT,
  progress_summary TEXT,
  emotion_words TEXT[],
  repeated_words TEXT[],
  positive_word_count INT DEFAULT 0,
  negative_word_count INT DEFAULT 0,
  neutral_word_count INT DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  layer2_pragmatic JSONB,
  layer3_temporal JSONB,
  layer4_goal JSONB,
  layer5_action JSONB,
  sentiment_score FLOAT,
  sentiment_baseline_delta FLOAT,
  layer_enrichment_status TEXT DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_l2 ON journal_entries USING GIN (layer2_pragmatic);
CREATE INDEX IF NOT EXISTS idx_l3 ON journal_entries USING GIN (layer3_temporal);
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own entries" ON journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own entries" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own entries" ON journal_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own entries" ON journal_entries FOR DELETE USING (auth.uid() = user_id);
```

**Script 2 — Create user_preferences table:**

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  goals JSONB,
  initial_emotions JSONB,
  stress_level INT,
  journaling_frequency TEXT,
  preferred_time TEXT,
  cfp_weight FLOAT DEFAULT 0.4,
  cfn_weight FLOAT DEFAULT 0.6,
  intervention_preference TEXT DEFAULT 'balanced',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON user_preferences
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**Script 3 — If upgrading an existing database (skip if creating fresh):**

```sql
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS sentiment_score FLOAT,
  ADD COLUMN IF NOT EXISTS sentiment_baseline_delta FLOAT,
  ADD COLUMN IF NOT EXISTS layer_enrichment_status TEXT DEFAULT 'pending';

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS cfp_weight FLOAT DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS cfn_weight FLOAT DEFAULT 0.6,
  ADD COLUMN IF NOT EXISTS intervention_preference TEXT DEFAULT 'balanced';
```

### 3. Deploy edge functions

```bash
supabase login
supabase link --project-ref your-project-ref
supabase secrets set GROQ_API_KEY=your_groq_key_here
supabase functions deploy analyze-journal
supabase functions deploy pragmatic-analysis
```

### 4. Run the frontend locally

```bash
cd Frontend
# Using VS Code Live Server: right-click index.html → Open with Live Server
# Or using Python:
python3 -m http.server 5500
# Or using Node:
npx serve .
```

Navigate to `http://localhost:5500/index.html`

### 5. Deploy to Vercel

Connect the GitHub repository to Vercel. Set the **Root Directory** to `Frontend` in Vercel project settings. No build command is needed — it is a static site.

> ⚠️ The Supabase anon key is safe to expose client-side as it is the public key. Row-level security policies enforce that users can only access their own data. The Groq API key must never appear in the frontend — it lives only in the Supabase edge function environment via `supabase secrets set`.

---

## 🔟 Conclusion

MindNook demonstrates how schema-constrained LLM inference, deterministic client-side NLP, and serverless edge architecture can be combined to build a psychologically grounded, analytically rich journaling platform. The five-layer hybrid design — pairing rule-based lexical analysis (with negation detection and expanded lexicons) with LLM-generated feedback and utility-theoretic action selection — provides both resilience and depth, ensuring core functionality even under inference failure.

Key architectural improvements in the current version include: individual sentiment baseline tracking (μuser and Δpersonal), multi-window temporal regression with stabilization detection and attention weights, configurable Cfp/Cfn weights derived from user onboarding preferences, an ethical action filter preventing inappropriate interventions, cross-device goal persistence via Supabase synchronisation, and enriched sentiment page data sourced from the database rather than local state.

All five framework layers are implemented, persisted to PostgreSQL, and actively used to shape AI responses. As the empirical prototype for a formally published sentiment-aware framework, MindNook establishes a clear architectural foundation for more rigorous experimentation in journal-domain language modeling, longitudinal affect tracking, and intent-aware response selection.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript, Quill.js |
| AI Inference | LLaMA 3.3 70B via Groq API |
| Backend / API | Deno Edge Functions on Supabase (2 functions) |
| Database | Supabase PostgreSQL with RLS |
| Client NLP | Custom lexicon + negation detection + `personal_baseline.js` (5-layer framework) |
| Visualization | Chart.js (mood timeline, tone chart, radar, heatmap) |
| Auth | Supabase Auth (email) with row-level security |
| Frontend Hosting | Vercel (static, root directory: `Frontend`) |
| Backend Hosting | Supabase Edge (serverless Deno runtime) |

---
<div align="center">

**Built by [Yamini G](https://github.com/yamireddy04)**

</div>
