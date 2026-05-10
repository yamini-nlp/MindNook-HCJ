# 🧠 MindNook — AI-Powered Journaling & NLP Analysis Platform

![Stack](https://img.shields.io/badge/Stack-HTML%20%7C%20CSS%20%7C%20JS%20%7C%20Deno%20%7C%20Supabase-1b2e2b?style=flat-square)
![LLM](https://img.shields.io/badge/LLM-LLaMA%203.3%2070B%20via%20Groq-d9c5b2?style=flat-square)
![Database](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-3ecf8e?style=flat-square)
![Status](https://img.shields.io/badge/Status-Active-7ecb84?style=flat-square)
![Preprint](https://img.shields.io/badge/Preprint-TechRxiv%20%7C%20IEEE-blue?style=flat-square)

A full-stack application that transforms personal writing into structured self-insight using large language models, sentiment analysis, and real-time vocabulary feedback.

Built with **HTML / CSS / JavaScript** for the frontend and **Deno Edge Functions on Supabase** for the backend.

🌐 **Live Demo:** https://mindnook-hcj.vercel.app

> 📄 **Research Foundation:** This application is the prototype system described in the TechRxiv preprint (powered by IEEE).
> Gabu Sai Yamini Devi. *"A System-Level Framework for Sentiment-Aware Reflective Writing Systems."* TechRxiv (IEEE Preprint), February 2026. [DOI: 10.36227/techrxiv.177274130.07417144/v1](https://doi.org/10.36227/techrxiv.177274130.07417144/v1)

---

## 1️⃣ Problem Statement

Despite the well-documented cognitive and emotional benefits of reflective writing, most journaling tools remain passive — they store text but provide no analytical feedback. Users have no mechanism to:

- Track emotional trends across entries over time
- Identify recurring linguistic weaknesses in their writing
- Receive contextually grounded feedback based on their own content

This project addresses the gap between passive journaling and active self-improvement by building a system that performs real-time sentiment classification, lexical analysis, and narrative generation on free-form personal writing entries.

---

## 2️⃣ Why It Matters

**From an NLP research perspective:** Free-form journaling is an underexplored domain for applied language models. Unlike product reviews or news articles, journal entries are informal, emotionally rich, and highly personal — making them a meaningful testbed for sentiment analysis and lexical analysis pipelines.

**From a systems perspective:** This project demonstrates the integration of a serverless edge function (Deno on Supabase) as a lightweight LLM gateway, decoupling the frontend from direct API key exposure while enabling low-latency inference via Groq's acceleration layer.

**From a human-computer interaction perspective:** The design prioritizes psychological safety — the interface is distraction-free, feedback is non-judgmental, and the system never surfaces raw critique without pairing it with constructive alternatives.

**From a research perspective:** This prototype operationalizes Layer 1 of the accompanying published framework, demonstrating practical application of schema-constrained LLM inference in a production-adjacent system.

---

## 3️⃣ Dataset

This application operates on **user-generated journal entries as live inference input**. No pre-existing benchmark dataset is used for runtime analysis.

For the client-side tone analysis module, two curated lexicons were hand-constructed:

| Lexicon | Size | Coverage |
|---|---|---|
| Positive word set | ~120 lemmas | Joy, gratitude, calm, motivation, achievement |
| Negative word set | ~130 lemmas | Sadness, anxiety, frustration, fear, defeat |

Stemming heuristics (suffix stripping: `-ing`, `-ed`, `-ly`, `-ness`, `-ful`, `-less`, `-s`) are applied before lookup to improve recall without requiring a full morphological analyzer.

The LLM (LLaMA 3.3 70B) serves as the primary analysis engine for fields where rule-based approaches are insufficient: grammar correction, expression enrichment, and narrative generation.

---

## 4️⃣ Methodology

The system follows a **hybrid architecture** combining rule-based client-side NLP with server-side LLM inference.

```
User Entry (Quill Rich Text Editor)
        │
        ▼
  [Client-Side NLP Preprocessing]
  - Regex-based tokenization
  - Stopword-aware unique word count
  - Lexical diversity: TTR = unique_tokens / total_tokens
  - Tone classification via lexicon lookup + stemming heuristics
        │
        ▼
  [Edge Function: Deno / Supabase]
  - Structured prompt construction
  - LLM call → LLaMA 3.3 70B via Groq API
  - JSON schema enforcement (response_format: json_object)
        │
        ▼
  [LLM-Returned Analysis Fields]
  - Sentiment: Positive / Negative / Neutral
  - Grammar mistake count + corrections
  - Vocabulary upgrade suggestions (entry-specific)
  - Expression enrichment (weak phrase → stronger alternative)
  - Contextual narrative: alternating story / quote per entry
        │
        ▼
  [Supabase PostgreSQL Persistence]
  - Full analysis record stored per entry
  - Enables streak tracking, mood timeline, aggregate statistics
```

Client-side and LLM-returned tone counts are blended (averaged) when both are non-zero, improving robustness against hallucinated counts from the model.

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

**Client-Side NLP Module**

Independent of the LLM, the frontend computes:

- **Type-Token Ratio (TTR)** — lexical diversity index (0–1)
- **Average sentence length** — structural complexity proxy
- **Tone word ratio** — positive / negative / neutral word counts via lexicon + stemming
- **Repeated word detection** — frequency threshold flagging

This dual-layer design ensures graceful degradation: if the LLM call fails, core metrics remain available from the client-side module.

**Relation to the Published 5-Layer Framework**

| Framework Layer | Description | Status |
|---|---|---|
| L1 — Sentiment Detection | Polarity classification via LLM + client-side lexicon | ✅ Implemented |
| L2 — Pragmatic Analysis | Speech act classification | 📋 Ongoing |
| L3 — Temporal Pattern Recognition | LSTM-based sentiment trend modeling | 📋 Planned |
| L4 — Goal Alignment | Mapping detected patterns to user goals | 📋 Planned |
| L5 — Utility-Based Action Selection | Optimal action under asymmetric intervention costs | 📋 Planned |

---

## 6️⃣ Results

The following observations are drawn from manual evaluation across test entries.

| Metric | Observation |
|---|---|
| Sentiment Classification | Consistent with human judgment on clearly valenced entries; ambiguous entries trend toward Neutral |
| Grammar Correction | High precision on common errors (subject-verb agreement, punctuation); lower recall on stylistic issues |
| Vocabulary Enrichment | Suggestions are contextually grounded — pulled from actual entry vocabulary, not generic lists |
| Narrative Generation | Story mode produces coherent 6–8 sentence arcs; quote attribution occasionally generic |
| Lexical Diversity (TTR) | Correlates meaningfully with perceived vocabulary richness across test entries |
| Inference Latency | Groq returns results within 1–2 seconds; three async AI calls on the vocabulary page run in parallel |

---

## 7️⃣ Limitations

- **L1-Only Coverage:** The system implements sentiment detection but not the pragmatic, temporal, or goal-aware layers proposed in the framework, making it subject to documented failure modes — context collapse, therapeutic misalignment, and intent ambiguity.
- **LLM Non-Determinism:** Repeated analysis of the same entry may return slightly different sentiment labels or mistake counts.
- **Lexicon Coverage:** The hand-curated word sets miss domain-specific or culturally nuanced expressions; a distributional lexicon (e.g., NRC Emotion Lexicon) would improve recall.
- **Grammar Checker Scope:** The LLM is not a dedicated grammar model and may miss subtle errors or flag stylistic choices incorrectly.
- **No User Authentication:** The current build uses the Supabase anon key with no row-level security — unsuitable for production deployment.
- **TTR Length Sensitivity:** Type-Token Ratio decreases as text length increases, making cross-entry comparisons unreliable at different word counts; MATTR or MTLD would be more robust.

---

## 8️⃣ Future Work

- Implement Layers 2–5 of the framework: pragmatic analysis, LSTM-based temporal pattern recognition, goal alignment, and utility-theoretic action selection
- User authentication and multi-user support via Supabase Auth with row-level security policies
- Longitudinal NLP analysis: track vocabulary growth, sentiment trends, and writing complexity over weeks with time-series visualizations
- Replace TTR with Moving-Average TTR (MATTR) to control for text length sensitivity
- Fine-tune a smaller model (e.g., DistilBERT) on journal-domain data for faster, more consistent classification
- Named entity and topic extraction to surface recurring themes across entries
- Privacy-preserving personalization via federated learning and on-device processing
- Multi-language support extending the lexicon and prompt pipeline to non-English entries

---

## 9️⃣ How to Run

**Prerequisites**

- Node.js (for local development server, e.g. VS Code Live Server or `npx serve`)
- Supabase CLI (for edge function deployment)
- A Groq API key

**Local Frontend**

```bash
git clone https://github.com/yamireddy04/MindNook-HCJ.git
cd MindNook-HCJ/Frontend
npx serve .
```

Navigate to: `http://localhost:5500/Frontend/index.html`

**Edge Function (Supabase)**

```bash
cd supabase/functions/analyze-journal

# Set your Groq API key as a Supabase secret
supabase secrets set GROQ_API_KEY=your_key_here

# Deploy the function
supabase functions deploy analyze-journal
```

**Database Setup**

In your Supabase project, create the `journal_entries` table:

```sql
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  content text,
  sentiment text,
  mood_lifter_content text,
  word_count int,
  sentence_count int,
  mistake_count int,
  lexical_feedback text[],
  unique_words int,
  readability text,
  writing_style text,
  lexical_diversity float,
  repeated_words text[],
  positive_word_count int,
  negative_word_count int,
  neutral_word_count int,
  emotion_words text[],
  progress_summary text,
  grammar_trend text,
  vocabulary_trend text
);
```

> ⚠️ The Supabase anon key is safe to expose client-side. The Groq API key must never appear in the frontend — it lives only in the Supabase edge function environment.

---

## 🔟 Conclusion

MindNook demonstrates how schema-constrained LLM inference, client-side NLP processing, and serverless edge architecture can be combined to build a psychologically grounded, analytically rich journaling platform. The hybrid design — pairing rule-based lexical analysis with LLM-generated feedback — provides both resilience and depth, ensuring core functionality even under inference failure. As the empirical prototype for a formally published sentiment-aware framework, MindNook establishes a clear architectural foundation for more rigorous experimentation in journal-domain language modeling, longitudinal affect tracking, and intent-aware response selection.

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript, Quill.js |
| AI Inference | LLaMA 3.3 70B via Groq API |
| Backend / API | Deno Edge Function on Supabase |
| Database | Supabase PostgreSQL |
| Visualization | Chart.js (sentiment timeline, tone donut) |
| Frontend Hosting | Vercel |
| Backend Hosting | Supabase Edge (serverless) |
