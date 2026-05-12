# 🧠 MindNook — AI-Powered Journaling & NLP Analysis Platform

![Stack](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Deno%20%7C%20Supabase-1b2e2b?style=flat-square)
![LLM](https://img.shields.io/badge/LLM-LLaMA%203.3%2070B%20via%20Groq-d9c5b2?style=flat-square)
![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ecf8e?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-7ecb84?style=flat-square)
![Preprint](https://img.shields.io/badge/Preprint-TechRxiv%20%7C%20IEEE-blue?style=flat-square)

A full-stack application that transforms personal writing into structured self-insight using large language models, a five-layer NLP framework, real-time sentiment analysis, and longitudinal mood tracking.

Built with **HTML / CSS / JavaScript** for the frontend and **Deno Edge Functions on Supabase** for the backend.

🌐 **Live Demo:** https://mindnook-hcj.vercel.app

> 📄 **Research Foundation:** This application is the prototype system described in the TechRxiv preprint (powered by IEEE).
> Gabu Sai Yamini Devi. *"A System-Level Framework for Sentiment-Aware Reflective Writing Systems."* TechRxiv (IEEE Preprint), February 2026. [DOI: 10.36227/techrxiv.177274130.07417144/v1](https://doi.org/10.36227/techrxiv.177274130.07417144/v1)

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

**From a human-computer interaction perspective:** The design prioritizes psychological safety — the interface is distraction-free, feedback is non-judgmental, and the system never surfaces raw critique without pairing it with constructive alternatives. The five-layer utility action system selects a response directive (affirm, encourage, reflect, support, or intervene) calibrated to the user's current emotional state and trajectory.

**From a research perspective:** This prototype operationalizes all five layers of the accompanying published framework and demonstrates practical application of schema-constrained LLM inference in a production-adjacent system.

---

## 3️⃣ Dataset

This application operates on **user-generated journal entries as live inference input**. No pre-existing benchmark dataset is used for runtime analysis.

For the client-side tone analysis module, two curated lexicons were hand-constructed:

| Lexicon | Size | Coverage |
|---|---|---|
| Positive word set | ~120 lemmas | Joy, gratitude, calm, motivation, achievement |
| Negative word set | ~130 lemmas | Sadness, anxiety, frustration, fear, defeat |

Stemming heuristics (suffix stripping: `-ing`, `-ed`, `-ly`, `-ness`, `-ful`, `-less`, `-s`) are applied before lookup to improve recall without requiring a full morphological analyzer.

The LLM (LLaMA 3.3 70B via Groq) serves as the primary analysis engine for fields where rule-based approaches are insufficient: grammar correction, expression enrichment, narrative generation, and all five framework layer outputs.

User onboarding data (stated journaling goals, initial emotional state, stress level, journaling frequency) is persisted to Supabase and used to personalise goal alignment scores and the utility-based action system across sessions and devices.

---

## 4️⃣ Methodology

The system implements a **five-layer hybrid architecture** combining deterministic client-side NLP with server-side LLM inference, with all layer outputs persisted to PostgreSQL for longitudinal analysis.

```
User Entry (Quill Rich Text Editor)
        │
        ▼
  [Client-Side NLP — personal_baseline.js]
  - Regex tokenization, unique word count, TTR
  - Lexicon-based tone classification with stemming
  - Layer 2: Pragmatic speech-act classification
    (assertion / expression / help-seeking / question)
  - Layer 3: Temporal trend via linear regression on
    deterministic sentiment scores (no randomness)
  - Layer 4: Goal alignment scoring against Supabase
    user_preferences (cross-device, not localStorage-only)
  - Layer 5: Utility score + action selection
    (affirm / encourage / reflect / support / intervene)
        │
        ▼
  [Edge Function: analyze-journal — Deno / Supabase]
  - mode=analysis: returns 17-field structured analysis
    (sentiment, word counts, lexical diversity, readability,
     writing style, grammar trend, vocabulary trend,
     emotion words, repeated words, mood lifter,
     vocabulary suggestions, progress summary)
  - mode=chat: routes Nook AI conversation using
    dynamic system prompt built from all 5 layers
  - mode=insights: generates AI growth cards for dashboard
  - response_format: json_object enforced
  - No Groq key in browser — all calls proxied here
        │
        ▼
  [Edge Function: pragmatic-analysis — Deno / Supabase]
  - type=combined: enriches Layer 2 (pragmatic) and
    Layer 4 (goal alignment) with server-side LLM analysis
  - Writes enriched results back to journal_entries
    layer2_pragmatic and layer4_goal columns directly
  - Called asynchronously after save — non-blocking
        │
        ▼
  [Supabase PostgreSQL Persistence]
  - Full 17-field analysis record stored per entry
  - All five layer outputs stored as JSONB columns
    (layer2_pragmatic, layer3_temporal, layer4_goal,
     layer5_action) with GIN indexes
  - user_preferences table stores goals cross-device
  - RLS policies enforce strict per-user data isolation
```

Client-side and LLM-returned tone counts are blended (averaged) when both are non-zero, improving robustness against hallucinated counts from the model. The temporal trend classifier uses deterministic sentiment score mapping (Positive→75, Negative→25, Neutral→50, refined by word-count ratios) — no randomness — making regression results reproducible.

---

## 5️⃣ Model Architecture

**LLM Backbone**

| Property | Value |
|---|---|
| Model | `llama-3.3-70b-versatile` |
| Provider | Groq (low-latency inference) |
| Deployment | Supabase Edge Function (Deno runtime) |
| Prompt Strategy | Single-turn, structured JSON schema injection |
| Output Format | `response_format: json_object` enforced |
| Temperature | 0.2–0.3 for analysis, 0.7 for chat and insights |

**Client-Side NLP Module — personal_baseline.js**

Independent of the LLM, the frontend computes:

- **Type-Token Ratio (TTR)** — lexical diversity index (0–1)
- **Average sentence length** — structural complexity proxy
- **Tone word ratio** — positive / negative / neutral word counts via lexicon + stemming
- **Repeated word detection** — frequency threshold flagging
- **Layer 2 Pragmatic Classification** — sentence-level speech act detection
- **Layer 3 Temporal Regression** — linear slope over deterministic sentiment scores
- **Layer 4 Goal Alignment** — weighted scoring against user-stated goals from Supabase
- **Layer 5 Utility Score** — weighted combination of L1–L4 outputs mapping to action directive

This dual-layer design ensures graceful degradation: if the LLM call fails, all five framework layers remain available from the client-side module with local fallback values.

**Five-Layer Framework Implementation**

| Framework Layer | Description | Implementation |
|---|---|---|
| L1 — Sentiment Detection | Polarity classification | Client lexicon + LLM (17-field response from analyze-journal) |
| L2 — Pragmatic Analysis | Speech act classification | Client `classifyPragmatic()` + LLM enrichment via pragmatic-analysis |
| L3 — Temporal Pattern Recognition | Longitudinal trend via linear regression | Client `classifyTemporalTrend()` over stored entries (deterministic) |
| L4 — Goal Alignment | Scoring entry against user-stated goals | Client `computeGoalAlignment()` + Supabase user_preferences |
| L5 — Utility-Based Action Selection | Response directive selection under asymmetric costs | Client `buildUtilityScore()` + `buildDynamicSystemPrompt()` |

All five layer outputs are persisted to PostgreSQL JSONB columns per entry and used to shape the Nook AI system prompt dynamically.

---

## 6️⃣ Results

The following observations are drawn from manual evaluation across test entries.

| Metric | Observation |
|---|---|
| Sentiment Classification | Consistent with human judgment on clearly valenced entries; ambiguous entries trend toward Neutral |
| Grammar Correction | High precision on common errors; lower recall on stylistic issues |
| Vocabulary Enrichment | Suggestions are entry-specific — pulled from actual entry vocabulary, not generic lists |
| Narrative Generation | Story mode produces coherent 6–8 sentence arcs alternating with contextually matched quotes |
| Lexical Diversity (TTR) | Correlates meaningfully with perceived vocabulary richness across test entries |
| Temporal Trend | Deterministic regression produces stable, reproducible slope values across identical inputs |
| Goal Alignment | Alignment score responds correctly to semantic content — stress-related entries score lower for stress-reduction goals |
| Nook AI Chat | Dynamic system prompt incorporating all 5 layers produces contextually appropriate response tones |
| Analytics Page | All charts (emotional intensity, style breakdown, growth metrics, heatmap) computed from real entry data — no hardcoded values |
| Inference Latency | Groq returns results within 1–2 seconds; pragmatic enrichment runs non-blocking post-save |

---

## 7️⃣ Limitations

- **LLM Non-Determinism:** Repeated analysis of the same entry may return slightly different sentiment labels or mistake counts due to LLM temperature.
- **Lexicon Coverage:** The hand-curated word sets miss domain-specific or culturally nuanced expressions; a distributional lexicon (e.g., NRC Emotion Lexicon) would improve recall.
- **Grammar Checker Scope:** The LLM is not a dedicated grammar model and may miss subtle errors or flag stylistic choices incorrectly.
- **TTR Length Sensitivity:** Type-Token Ratio decreases as text length increases, making cross-entry comparisons unreliable at very different word counts; MATTR or MTLD would be more robust for long-form entries.
- **Goal Alignment from localStorage Fallback:** When Supabase user_preferences is unavailable, goal alignment falls back to localStorage, which is device-specific.
- **Pragmatic Enrichment Timing:** The LLM-enriched pragmatic result is written asynchronously — the sentiment page may briefly display the client-side result before the enriched version propagates.

---

## 8️⃣ Future Work

- Replace TTR with Moving-Average TTR (MATTR) to control for text length sensitivity in longitudinal vocabulary comparisons
- Fine-tune a smaller model (e.g., DistilBERT) on journal-domain data for faster, more consistent Layer 1 classification
- Named entity and topic extraction to surface recurring themes across entries in the analytics dashboard
- Implement LSTM-based temporal modeling for Layer 3 to replace linear regression with learned sequence representations
- Privacy-preserving personalization via federated learning and on-device processing
- Multi-language support extending the lexicon and prompt pipeline to non-English entries
- Real-time as-you-type sentiment feedback using debounced client-side analysis
- Export functionality for entries and analytics (PDF, CSV)

---

## 9️⃣ How to Run

**Prerequisites**

- A Supabase account and project
- A Groq API key (free at console.groq.com)
- Supabase CLI installed (`npm install -g supabase`)
- VS Code with Live Server extension, or any static file server

**1. Clone the repository**

```bash
git clone https://github.com/yamireddy04/MindNook-HCJ.git
cd MindNook-HCJ
```

**2. Set up the database**

In your Supabase project SQL Editor, run these three scripts in order:

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
  layer5_action JSONB
);
CREATE INDEX IF NOT EXISTS idx_l2 ON journal_entries USING GIN (layer2_pragmatic);
CREATE INDEX IF NOT EXISTS idx_l3 ON journal_entries USING GIN (layer3_temporal);
```

```sql
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own entries" ON journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own entries" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own entries" ON journal_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own entries" ON journal_entries FOR DELETE USING (auth.uid() = user_id);
```

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  goals JSONB,
  initial_emotions JSONB,
  stress_level INT,
  journaling_frequency TEXT,
  preferred_time TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON user_preferences
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**3. Deploy edge functions**

```bash
supabase login
supabase link --project-ref your-project-ref
supabase secrets set GROQ_API_KEY=your_groq_key_here
supabase functions deploy analyze-journal
supabase functions deploy pragmatic-analysis
```

**4. Run the frontend locally**

```bash
cd Frontend
# Using VS Code Live Server: right-click index.html → Open with Live Server
# Or using Python:
python3 -m http.server 5500
# Or using Node:
npx serve .
```

Navigate to `http://localhost:5500/index.html`

**5. Deploy to Vercel**

Connect the GitHub repository to Vercel. Set the **Root Directory** to `Frontend` in Vercel project settings. No build command is needed — it is a static site.

> ⚠️ The Supabase anon key is safe to expose client-side as it is the public key. Row-level security policies enforce that users can only access their own data. The Groq API key must never appear in the frontend — it lives only in the Supabase edge function environment via `supabase secrets set`.

---

## 🔟 Conclusion

MindNook demonstrates how schema-constrained LLM inference, deterministic client-side NLP, and serverless edge architecture can be combined to build a psychologically grounded, analytically rich journaling platform. The five-layer hybrid design — pairing rule-based lexical analysis with LLM-generated feedback and utility-theoretic action selection — provides both resilience and depth, ensuring core functionality even under inference failure. All five framework layers are implemented, persisted to PostgreSQL, and actively used to shape AI responses. As the empirical prototype for a formally published sentiment-aware framework, MindNook establishes a clear architectural foundation for more rigorous experimentation in journal-domain language modeling, longitudinal affect tracking, and intent-aware response selection.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript, Quill.js |
| AI Inference | LLaMA 3.3 70B via Groq API |
| Backend / API | Deno Edge Functions on Supabase (2 functions) |
| Database | Supabase PostgreSQL with RLS |
| Client NLP | Custom lexicon + personal_baseline.js (5-layer framework) |
| Visualization | Chart.js (mood timeline, tone chart, radar, heatmap) |
| Auth | Supabase Auth (email) with row-level security |
| Frontend Hosting | Vercel (static, root directory: Frontend) |
| Backend Hosting | Supabase Edge (serverless Deno runtime) |
