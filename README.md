# 🧠 MindNook — Sentiment-Aware Reflective Writing System

> A full-stack journaling platform implementing a five-layer hybrid NLP framework for real-time sentiment analysis, longitudinal mood tracking, and utility-based AI response selection — built as the reference implementation of a published system-level framework.

**Live Demo:** https://mindnook-hcj.vercel.app &nbsp;|&nbsp; **Repository:** https://github.com/yamini-nlp/MindNook-HCJ &nbsp;|&nbsp; **Preprint:** https://doi.org/10.36227/techrxiv.177274130.07417144/v1

![Stack](https://img.shields.io/badge/Stack-HTML%20%7C%20JS%20%7C%20Deno%20%7C%20Supabase-blue?style=flat-square)
![LLM](https://img.shields.io/badge/LLM-LLaMA%203.3%2070B%20%7C%20Groq-orange?style=flat-square)
![DB](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-green?style=flat-square)
![Status](https://img.shields.io/badge/Status-Live-brightgreen?style=flat-square)

---

## 💡 Motivation

Most journaling tools are passive storage: they collect text and return nothing. There is no mechanism to track emotional trends over time, weigh a new entry against a user's own history rather than a population average, or decide — in a principled, adjustable way — when a reflective AI companion should simply listen versus when it should gently intervene. This project exists to close that gap: it operationalises a five-layer analytical framework (sentiment, pragmatics, temporal trend, goal alignment, utility-based action selection) that I first specified in a published preprint, then implements and runs all five layers end-to-end in a deployed application rather than leaving them as a paper design.

---

## 🧭 Overview

MindNook is the prototype system described in the accompanying TechRxiv (IEEE) preprint:

> Gabu Sai Yamini Devi. *A System-Level Framework for Sentiment-Aware Reflective Writing Systems.* TechRxiv (IEEE Preprint), February 2026. DOI: [10.36227/techrxiv.177274130.07417144/v1](https://doi.org/10.36227/techrxiv.177274130.07417144/v1)

The application computes all five framework layers on every journal entry, persists each layer's output to PostgreSQL, and uses those outputs to dynamically construct the system prompt for the in-app AI companion, Nook AI — so the framework isn't just measured, it actively shapes what the user sees.

---

## 🎯 Problem Statement

Journaling tools that only store text give users no way to notice their own patterns: whether their mood is trending up or down over weeks, whether today's entry is unusual relative to their personal baseline, or whether what they're writing actually reflects the goals they set for themselves. MindNook addresses this by combining rule-based client-side NLP with LLM inference, per-user statistical baselining, temporal regression, and utility-theoretic response selection — all computed per entry, not as a one-off analysis.

---

## 🧩 What It Does

- **Reflective journaling** — a distraction-free rich-text editor (Quill.js) for daily entries.
- **Real-time linguistic feedback** — lexical diversity (type-token ratio), tone-word ratios, readability, and repeated/emotion-word extraction computed on every save.
- **Personal baseline tracking** — each entry's sentiment score is compared against the user's own historical mean (μ_user), not a fixed threshold, and reported as a z-score deviation.
- **Longitudinal mood analytics** — a dashboard (Chart.js) visualising mood timelines, tone breakdowns, and trend direction across a user's entry history.
- **Nook AI companion** — a chat interface whose system prompt is rebuilt per conversation from the live values of all five framework layers, so its tone (`affirm` / `encourage` / `reflect` / `support` / `intervene`) is derived from the user's actual current state rather than fixed.
- **Configurable sensitivity** — users set their own false-positive/false-negative cost trade-off during onboarding, directly changing the threshold at which the system recommends supportive intervention.
- **Vocabulary and growth tools** — a vocabulary builder and a freeform canvas page alongside the core journaling flow.

---

## 🔬 Five-Layer Framework

| Layer | Function | Implementation |
|---|---|---|
| L1 — Sentiment Detection | Polarity + numeric score (0–100) | Client lexicon + LLM (`sentimentScore`, `sentimentConfidence`) |
| L2 — Pragmatic Analysis | Speech-act classification (assertion / expression / help-seeking / question) | Client `classifyPragmatic()` + async LLM enrichment |
| L3 — Temporal Pattern Recognition | Multi-window longitudinal trend, stabilisation and cyclical-pattern detection | OLS regression over short (n=3) vs long (n=10) windows, exponential attention weights, variance-based cyclicality check |
| L4 — Goal Alignment | Scoring against user-stated goals | `computeGoalAlignment()` + Supabase `user_preferences` sync via `syncGoalsFromSupabase()` |
| L5 — Utility-Based Action Selection | Response directive under a configurable cost asymmetry τ* = C_fp / (C_fp + C_fn) | `buildUtilityScore()` + `applyEthicalFilter()` + `buildDynamicSystemPrompt()` |

All five outputs are stored as JSONB columns in PostgreSQL per entry and used to construct the Nook AI system prompt dynamically.

---

## 🏗️ System Architecture

```
User Entry (Quill Rich Text Editor)
        │
        ▼
  [Client-Side NLP — personal_baseline.js]
  ├── Tokenisation, TTR, sentence length
  ├── Lexicon-based tone classification (negation-aware, phrase matching)
  ├── Individual baseline: μ_user = mean(sentiment_scores)
  │   Δ_personal = current − μ_user (z-score normalised)
  ├── L2: Pragmatic classification (assertion / expression / help-seeking / question)
  ├── L3: Multi-window OLS regression + stabilisation/cyclicality detection + attention weights
  ├── L4: Goal alignment vs Supabase user_preferences
  └── L5: τ* = C_fp / (C_fp + C_fn); applyEthicalFilter()
        │
        ▼
  [Edge Function: analyze-journal — Deno / Supabase]
  ├── mode=analysis  → structured per-entry analysis record
  ├── mode=chat      → Nook AI via dynamic system prompt (all 5 layers)
  └── mode=insights  → AI growth cards for the analytics dashboard
        │
        ▼
  [Edge Function: pragmatic-analysis — Deno / Supabase]
  ├── Validates the caller's Supabase JWT via supabase.auth.getUser() before any inference
  ├── Enriches L2 (pragmatic) and L4 (goal alignment) via Groq (llama-3.3-70b-versatile, temp 0.2)
  ├── Recomputes L5 (utility action) server-side from the enriched values
  └── Writes layer2_pragmatic, layer4_goal, layer5_action, layer_enrichment_status = 'complete'
        │
        ▼
  [Supabase PostgreSQL]
  ├── Structured analysis record per entry
  ├── JSONB columns: layer2–layer5 (GIN indexed)
  ├── sentiment_score FLOAT, sentiment_baseline_delta FLOAT
  ├── user_preferences: goals, C_fp, C_fn, intervention_preference (cross-device)
  └── RLS policies: strict per-user data isolation on every table
```

> **Graceful degradation:** if LLM inference fails or is still pending, all five framework layers remain available from client-computed local fallback values, so the UI never blocks on the network round-trip.

---

## ⚙️ Client-Side NLP Module (`personal_baseline.js`)

Computed independently of the LLM on every entry save, so the app has usable output even before (or if) any LLM call returns:

- **Type-Token Ratio (TTR):** lexical diversity index (0–1)
- **Tone word ratio:** positive / negative / neutral counts via custom lexicons, with phrase-level matching for help-seeking and expressive speech
- **Individual baseline deviation:** `computeSentimentBaseline()` computes μ_user and its variance/stdDev from entry history; `computePersonalBaselineDelta()` returns the current entry's z-score deviation from that baseline
- **L2 pragmatic classification:** `classifyPragmatic()` — sentence-level speech-act detection via lexical pattern matching, no LLM required
- **L3 multi-window regression:** `classifyTemporalTrend()` — short-window (n=3) vs long-window (n=10) OLS slope, with an additional recent-vs-older slope comparison to detect stabilisation, and a variance threshold to flag cyclical patterns
- **L4 goal alignment:** `computeGoalAlignment()` — weighted scoring against goals synced from Supabase via `syncGoalsFromSupabase()`
- **L5 utility score:** `buildUtilityScore()` computes τ* = C_fp / (C_fp + C_fn) and a bounded utility value from sentiment, trend, goal, and pragmatic signals; `applyEthicalFilter()` overrides the resulting action to prevent clinical/diagnostic response labels and to suppress intervention when entry history is too short or sentiment isn't actually negative

---

## 🎛️ Configurable AI Sensitivity (C_fp / C_fn)

Users set asymmetric misclassification costs during onboarding, stored in `user_preferences` and synced across devices:

| Setting | C_fp | C_fn | τ* | Effect |
|---|---|---|---|---|
| Minimal | 0.6 | 0.4 | 0.60 | Conservative; rarely suggests support |
| Balanced (default) | 0.4 | 0.6 | 0.40 | Standard intervention threshold |
| Proactive | 0.25 | 0.75 | 0.25 | Earlier support on negative patterns |

---

## 🤖 LLM Configuration

| Property | Value |
|---|---|
| Model | `llama-3.3-70b-versatile` via Groq |
| Deployment | Supabase Edge Functions (Deno runtime) |
| Output format | `response_format: json_object` enforced, with a fallback that strips markdown fences and re-parses if a fenced block slips through |
| Temperature | 0.2 for L2/L4 enrichment (`pragmatic-analysis`), higher for chat/insights generation |
| Auth on inference calls | `pragmatic-analysis` requires a valid Supabase JWT (`supabase.auth.getUser()`) before it will call the LLM at all |

---

## ⚙️ Key Design Decisions

| Component | Choice | Rationale |
|---|---|---|
| Client-first computation | All five layers have a local, non-LLM fallback | The app degrades gracefully instead of blocking on network/LLM latency |
| Async enrichment | `pragmatic-analysis` runs as a non-blocking post-save call | L2/L4 refinement doesn't delay the entry save response |
| Per-user baselining | μ_user computed from the user's own history, not a population norm | A "negative" entry is judged against what's normal *for that person* |
| Utility framing for L5 | Cost-asymmetric threshold (τ*) rather than a fixed sentiment cutoff | Lets the user tune how proactively the system offers support, instead of hard-coding one answer |
| JSONB + GIN indexes | Layer outputs stored as indexed JSONB rather than flattened columns | Keeps heterogeneous per-layer structure queryable without a rigid schema migration per layer change |
| Row-Level Security | Enforced on `journal_entries` and `user_preferences` | Per-user data isolation is enforced at the database layer, not just in application code |

---

## 📊 Observed Behaviour (Manual Evaluation)

| Metric | Observation |
|---|---|
| Sentiment classification | Consistent with human judgement on clearly valenced entries; ambiguous entries trend toward Neutral |
| Individual baseline deviation | Z-score correctly identifies entries unusually positive or negative relative to user history |
| Temporal trend | Multi-window OLS produces stable, reproducible slope values; stabilisation and cyclicality flags trigger as designed |
| Goal alignment | Score responds to semantic content — stress-related entries score lower against stress-reduction goals |
| Nook AI chat | Dynamic system prompt incorporating all five layers produces contextually grounded, safe response tones |
| Inference latency | Groq returns results within 1–2 seconds; pragmatic enrichment runs non-blocking post-save |

*Quantitative accuracy figures against a labelled held-out set are not reported; formal evaluation is identified as future work.*

---

## 🔒 Security

- Row-Level Security is enabled on `journal_entries` and `user_preferences`, with explicit per-user `SELECT`/`INSERT`/`UPDATE`/`DELETE` policies — isolation is enforced by Postgres, not just application logic.
- `pragmatic-analysis` rejects any request without a valid Supabase JWT before it will call the LLM or touch the database.
- The Supabase anon key is a public, RLS-scoped key by design and is safe to ship client-side; the Groq key is intended to live only in the edge function's environment (`supabase secrets set GROQ_API_KEY=...`) and should never appear in frontend source — this is enforced by convention in the edge functions and needs to stay that way in any client-side code added later.

---

## ⚠️ Limitations

- **LLM non-determinism:** repeated analysis of the same entry may return slightly different sentiment labels due to temperature.
- **Lexicon coverage:** hand-curated word sets miss domain-specific or culturally nuanced expressions; a distributional lexicon (e.g. NRC Emotion Lexicon) would improve recall.
- **TTR length sensitivity:** TTR decreases as text length increases; MATTR or MTLD would be more robust for cross-entry vocabulary comparison.
- **L3 regression scope:** multi-window OLS does not capture non-linear temporal patterns; LSTM-based temporal modelling is identified as future work.
- **Pragmatic enrichment timing:** the enriched result is written asynchronously — the sentiment page may briefly display local heuristic values before the DB write completes.
- **No population norms:** the individual baseline is computed against the user's own history only; cross-user normalisation is not implemented.

---

## 🔭 Future Work

- Replace TTR with Moving-Average TTR (MATTR) to control for text length in longitudinal comparisons.
- Fine-tune a smaller classification model (e.g. DistilBERT) on journal-domain data for consistent L1 classification with calibrated probability output.
- Implement LSTM-based temporal modelling for L3 to replace OLS regression with learned sequence representations.
- Implicit goal inference from interaction history using a trained goal-representation model.
- Named entity and topic extraction to surface recurring themes across entries in the analytics dashboard.
- Privacy-preserving personalisation via federated learning and on-device processing.
- Multi-language support extending the lexicon and prompt pipeline to non-English entries.
- Export functionality for entries and analytics (PDF, CSV).

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript, Quill.js |
| AI Inference | LLaMA 3.3 70B via Groq API |
| Backend / API | Deno Edge Functions on Supabase (`analyze-journal`, `pragmatic-analysis`) |
| Database | Supabase PostgreSQL with RLS |
| Client NLP | Custom lexicon + negation detection + `personal_baseline.js` (5-layer framework) |
| Visualisation | Chart.js (mood timeline, tone chart, radar, heatmap) |
| Auth | Supabase Auth (email) with row-level security |
| Frontend Hosting | Vercel (static; root directory: `Frontend`) |
| Backend Hosting | Supabase Edge (serverless Deno runtime) |

---

## 🚀 Local Setup

**Prerequisites:** Supabase account · Groq API key · Supabase CLI (`npm install -g supabase`) · VS Code with Live Server or any static file server

**1. Clone**
```bash
git clone https://github.com/yamini-nlp/MindNook-HCJ.git
cd MindNook-HCJ
```

**2. Create database tables**

Run in your Supabase SQL Editor:

```sql
CREATE TABLE journal_entries (
  id                       BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  created_at               TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  content                  TEXT NOT NULL,
  sentiment                TEXT,
  word_count               INT DEFAULT 0,
  sentence_count           INT DEFAULT 0,
  mistake_count            INT DEFAULT 0,
  lexical_feedback         JSONB,
  unique_words             INT DEFAULT 0,
  lexical_diversity        FLOAT DEFAULT 0,
  readability              TEXT,
  writing_style            TEXT,
  grammar_trend            TEXT,
  vocabulary_trend         TEXT,
  progress_summary         TEXT,
  emotion_words            TEXT[],
  repeated_words           TEXT[],
  positive_word_count      INT DEFAULT 0,
  negative_word_count      INT DEFAULT 0,
  neutral_word_count       INT DEFAULT 0,
  mood_lifter_content      TEXT,
  user_id                  UUID REFERENCES auth.users(id),
  layer2_pragmatic         JSONB,
  layer3_temporal          JSONB,
  layer4_goal              JSONB,
  layer5_action            JSONB,
  sentiment_score          FLOAT,
  sentiment_baseline_delta FLOAT,
  layer_enrichment_status  TEXT DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_created_at ON journal_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_l2 ON journal_entries USING GIN (layer2_pragmatic);
CREATE INDEX IF NOT EXISTS idx_l3 ON journal_entries USING GIN (layer3_temporal);
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own entries"    ON journal_entries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own entries" ON journal_entries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own entries" ON journal_entries FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own entries" ON journal_entries FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_preferences (
  id                      BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  user_id                 UUID REFERENCES auth.users(id) UNIQUE,
  goals                   JSONB,
  initial_emotions        JSONB,
  stress_level            INT,
  journaling_frequency    TEXT,
  preferred_time          TEXT,
  cfp_weight              FLOAT DEFAULT 0.4,
  cfn_weight              FLOAT DEFAULT 0.6,
  intervention_preference TEXT DEFAULT 'balanced',
  created_at              TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
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

**4. Run frontend**
```bash
cd Frontend
python3 -m http.server 5500
# or: right-click index.html in VS Code → Open with Live Server
```
Navigate to `http://localhost:5500/index.html`

**5. Deploy to Vercel**

Connect the GitHub repository. Set Root Directory to `Frontend`. No build command required.

> ⚠️ The Supabase anon key is safe to expose client-side (public key); RLS enforces per-user isolation. The Groq API key must never appear in frontend source — set it only via `supabase secrets set`.

---

## 📁 Repository Structure

```
MindNook-HCJ/
├── Frontend/
│   ├── index.html
│   ├── login.html
│   ├── onboarding.html
│   ├── dashboard.html
│   ├── analysis.html
│   ├── sentiment.html
│   ├── history.html
│   ├── vocab.html
│   ├── canvas.html
│   ├── nook-ai.html
│   ├── app.js                      # Feature grid + core UI logic
│   ├── auth.js                     # Supabase auth handling
│   ├── env.js                      # Environment config
│   ├── personal_baseline.js        # Five-layer client NLP module
│   └── images/                     # Logo + UI assets
├── supabase/
│   └── functions/
│       ├── analyze-journal/
│       │   ├── deno.json
│       │   └── index.ts            # Deno edge function — analysis + chat + insights
│       └── pragmatic-analysis/
│           └── index.ts            # Deno edge function — async L2/L4 enrichment
├── sentiment_aware_framework.pdf   # Published preprint
├── LICENSE
└── README.md
```

---

<div align="center">

*Built by Yamini G &nbsp;·&nbsp; [GitHub](https://github.com/yamini-nlp/MindNook-HCJ) &nbsp;·&nbsp; [Live Demo](https://mindnook-hcj.vercel.app) &nbsp;·&nbsp; [Preprint](https://doi.org/10.36227/techrxiv.177274130.07417144/v1)*

</div>
