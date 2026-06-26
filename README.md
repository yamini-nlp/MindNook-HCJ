# 🧠 MindNook — Sentiment-Aware Reflective Writing System

> A full-stack journaling platform implementing a five-layer hybrid NLP framework for real-time sentiment analysis, longitudinal mood tracking, and utility-based AI response selection.

**Live Demo:** https://mindnook-hcj.vercel.app &nbsp;|&nbsp; 
**Preprint:** https://doi.org/10.36227/techrxiv.177274130.07417144/v1

![Stack](https://img.shields.io/badge/Stack-HTML%20%7C%20JS%20%7C%20Deno%20%7C%20Supabase-blue?style=flat-square)
![LLM](https://img.shields.io/badge/LLM-LLaMA%203.3%2070B%20%7C%20Groq-orange?style=flat-square)
![DB](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-green?style=flat-square)
![Status](https://img.shields.io/badge/Status-Live-brightgreen?style=flat-square)

---

## Overview

MindNook is the prototype system described in the accompanying TechRxiv (IEEE) preprint:

> Gabu Sai Yamini Devi. *A System-Level Framework for Sentiment-Aware Reflective Writing Systems.* TechRxiv (IEEE Preprint), February 2026. DOI: 10.36227/techrxiv.177274130.07417144/v1

The system operationalises all five layers of the published framework — sentiment detection, pragmatic speech-act classification, temporal trend recognition, goal alignment scoring, and utility-based action selection — in a production-deployed journaling application. All layer outputs are persisted to PostgreSQL and actively used to shape AI companion responses.

---

## 🎯 Problem Statement

Most journaling tools are passive storage — they collect text but provide no analytical feedback. Users have no mechanism to track emotional trends over time, identify linguistic patterns, or receive feedback grounded in their own stated goals.

This project addresses the gap between passive journaling and active self-reflection by combining rule-based client-side NLP with LLM inference, temporal regression, and utility-theoretic response selection.

---

## 📄 Research Foundation

This application is the prototype implementation described in a formally published framework. The framework specifies five analytical layers for sentiment-aware journaling systems; MindNook implements and evaluates all five in a deployed system.

**Publication:** Gabu Sai Yamini Devi. *A System-Level Framework for Sentiment-Aware Reflective Writing Systems.* TechRxiv (IEEE Preprint), February 2026.
DOI: [10.36227/techrxiv.177274130.07417144/v1](https://doi.org/10.36227/techrxiv.177274130.07417144/v1)

---

## 🔬 Five-Layer Framework

| Layer | Function | Implementation |
|---|---|---|
| L1 — Sentiment Detection | Polarity + numeric score (0–100) | Client lexicon + LLM (`sentimentScore`, `sentimentConfidence`) |
| L2 — Pragmatic Analysis | Speech-act classification | Client `classifyPragmatic()` + async LLM enrichment |
| L3 — Temporal Pattern Recognition | Multi-window longitudinal trend | OLS regression, short (n=3) vs long (n=10) window, attention weights |
| L4 — Goal Alignment | Scoring against user-stated goals | `computeGoalAlignment()` + Supabase `user_preferences` sync |
| L5 — Utility-Based Action Selection | Response directive under configurable cost asymmetry | `buildUtilityScore()` + `applyEthicalFilter()` + `buildDynamicSystemPrompt()` |

All five outputs are stored as JSONB columns in PostgreSQL per entry and used to construct the Nook AI system prompt dynamically.

---

## 🏗️ System Architecture

```
User Entry (Quill Rich Text Editor)
        │
        ▼
  [Client-Side NLP — personal_baseline.js]
  ├── Tokenisation, TTR, sentence length
  ├── Lexicon-based tone classification (negation detection, stemming)
  ├── Individual baseline: μ_user = mean(sentiment_scores)
  │   Δ_personal = current − μ_user (z-score normalised)
  ├── L2: Pragmatic classification (assertion / expression / help-seeking / question)
  ├── L3: Multi-window OLS regression + stabilisation detection + attention weights
  ├── L4: Goal alignment vs Supabase user_preferences
  └── L5: τ* = C_fp / (C_fp + C_fn); applyEthicalFilter()
        │
        ▼
  [Edge Function: analyze-journal — Deno / Supabase]
  ├── mode=analysis  → 19-field structured JSON
  ├── mode=chat      → Nook AI via dynamic system prompt (all 5 layers)
  ├── mode=insights  → AI growth cards for analytics dashboard
  └── JWT validated on all authenticated requests; Groq key never exposed to browser
        │
        ▼
  [Edge Function: pragmatic-analysis — Deno / Supabase]
  ├── Enriches L2 (pragmatic) and L4 (goal alignment) server-side
  ├── Recomputes L5 (utility action) using enriched values
  ├── Writes: layer2_pragmatic, layer4_goal, layer5_action, layer_enrichment_status = 'complete'
  └── Non-blocking async call; does not delay save response
        │
        ▼
  [Supabase PostgreSQL]
  ├── 19-field analysis record per entry
  ├── JSONB columns: layer2–layer5 (GIN indexed)
  ├── sentiment_score FLOAT, sentiment_baseline_delta FLOAT
  ├── user_preferences: goals, C_fp, C_fn, intervention_preference (cross-device)
  └── RLS policies: strict per-user data isolation
```

> **Graceful degradation:** if LLM inference fails, all five framework layers remain available from the client-side module using local fallback values.

---

## ⚙️ Client-Side NLP Module (`personal_baseline.js`)

Computed independently of the LLM on every entry save:

- **Type-Token Ratio (TTR):** lexical diversity index (0–1)
- **Tone word ratio:** positive / negative / neutral counts via custom lexicons (~150 lemmas each) with suffix-stripping stemming and 3-token negation window
- **Individual baseline deviation:** `computeSentimentBaseline()` computes μ_user; `computePersonalBaselineDelta()` returns z-score deviation of current entry
- **L2 pragmatic classification:** sentence-level speech-act detection
- **L3 multi-window regression:** short-window (n=3) vs long-window (n=10) OLS slope with exponential attention weights and stabilisation detection
- **L4 goal alignment:** weighted scoring against goals synced from Supabase via `syncGoalsFromSupabase()`
- **L5 utility score:** τ* = C_fp/(C_fp + C_fn); `applyEthicalFilter()` prevents inappropriate intervention directives

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
| Deployment | Supabase Edge Function (Deno runtime) |
| Output format | `response_format: json_object` enforced |
| Temperature | 0.2–0.3 (analysis), 0.7 (chat / insights) |
| API key exposure | None — all inference proxied through edge function |

---

## 📊 Observed Behaviour (Manual Evaluation)

| Metric | Observation |
|---|---|
| Sentiment classification | Consistent with human judgement on clearly valenced entries; ambiguous entries trend toward Neutral |
| Individual baseline deviation | Z-score correctly identifies entries unusually positive or negative relative to user history |
| Temporal trend | Multi-window OLS produces stable, reproducible slope values; stabilisation correctly detected |
| Goal alignment | Score responds to semantic content — stress-related entries score lower for stress-reduction goals |
| Nook AI chat | Dynamic system prompt incorporating all 5 layers produces contextually grounded, safe response tones |
| Inference latency | Groq returns results within 1–2 seconds; pragmatic enrichment runs non-blocking post-save |

*Quantitative accuracy figures against a labelled held-out set are not reported; formal evaluation is identified as future work.*

---

## ⚠️ Limitations

- **LLM non-determinism:** repeated analysis of the same entry may return slightly different sentiment labels due to temperature
- **Lexicon coverage:** hand-curated word sets miss domain-specific or culturally nuanced expressions; a distributional lexicon (e.g. NRC Emotion Lexicon) would improve recall
- **TTR length sensitivity:** TTR decreases as text length increases; MATTR or MTLD would be more robust for cross-entry vocabulary comparison
- **L3 regression scope:** multi-window OLS does not capture non-linear temporal patterns; LSTM-based temporal modelling is identified as future work
- **Pragmatic enrichment timing:** enriched result is written asynchronously — the sentiment page may briefly display local heuristic values before the DB write completes
- **No population norms:** individual baseline is computed against the user's own history only; cross-user normalisation is not implemented

---

## 🔭 Future Work

- Replace TTR with Moving-Average TTR (MATTR) to control for text length in longitudinal comparisons
- Fine-tune a smaller classification model (e.g. DistilBERT) on journal-domain data for consistent L1 classification with calibrated probability output
- Implement LSTM-based temporal modelling for L3 to replace OLS regression with learned sequence representations
- Implicit goal inference from interaction history using a trained goal-representation model
- Named entity and topic extraction to surface recurring themes across entries in the analytics dashboard
- Privacy-preserving personalisation via federated learning and on-device processing
- Multi-language support extending the lexicon and prompt pipeline to non-English entries
- Export functionality for entries and analytics (PDF, CSV)

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
git clone https://github.com/yamireddy04/MindNook-HCJ.git
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

> ⚠️ The Supabase anon key is safe to expose client-side (public key); RLS enforces per-user isolation. The Groq API key must never appear in the frontend — set it only via `supabase secrets set`.

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
│   ├── app.js                      # Core app logic
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

*Built by Yamini G &nbsp;·&nbsp; [GitHub](https://github.com/yamireddy04/MindNook-HCJ) &nbsp;·&nbsp; [Live Demo](https://mindnook-hcj.vercel.app) &nbsp;·&nbsp; [Preprint](https://doi.org/10.36227/techrxiv.177274130.07417144/v1)*

</div>
