# 🧠 MindNook — Sentiment-Aware Reflective Writing System

A full-stack journaling platform implementing a five-layer NLP framework for real-time sentiment analysis, longitudinal mood tracking, and utility-based AI response selection — built as the reference implementation of a published system-level framework, with client-side safety screening, per-user privacy controls, and an automated test suite.

**Repository:** https://github.com/yamini-nlp/MindNook-HCJ
**Preprint:** https://doi.org/10.36227/techrxiv.177274130.07417144/v1

![Stack](https://img.shields.io/badge/Stack-HTML%20%7C%20JS%20%7C%20Deno%20%7C%20Supabase-blue?style=flat-square)
![LLM](https://img.shields.io/badge/LLM-LLaMA%203.3%2070B%20%7C%20Groq-orange?style=flat-square)
![DB](https://img.shields.io/badge/Database-Supabase%20PostgreSQL-green?style=flat-square)
![Tests](https://img.shields.io/badge/Tests-35%20passing%20(Vitest)-brightgreen?style=flat-square)

---

## 💡 Motivation

Most journaling tools are passive storage: they collect text and return nothing. There is no mechanism to track emotional trends over time, weigh a new entry against a user's own history rather than a fixed population average, or decide — in a principled, adjustable way — when a reflective AI companion should simply listen versus when it should gently intervene, with a safeguard for when it gets that decision wrong. MindNook implements a five-layer analytical framework (sentiment, pragmatics, temporal trend, goal alignment, utility-based action selection) first specified in a published preprint, wraps it in a moderation and crisis-safety layer, and gives the user direct control over what gets inferred about them and what happens to that data.

---

## 📖 Overview

MindNook is the prototype system described in the accompanying TechRxiv (IEEE) preprint:

> Gabu Sai Yamini Devi. *A System-Level Framework for Sentiment-Aware Reflective Writing Systems.* TechRxiv (IEEE Preprint), February 2026. DOI: [10.36227/techrxiv.177274130.07417144/v1](https://doi.org/10.36227/techrxiv.177274130.07417144/v1)

The application computes all five framework layers on every journal entry, persists each layer's output to PostgreSQL, and uses those outputs to dynamically construct the system prompt for the in-app AI companion, Nook AI — so the framework isn't just measured, it actively shapes what the user sees. A safety and consent layer sits around that core: acute-risk screening, LLM output moderation with regeneration, per-layer opt-outs, and full data export/delete.

---

## ✨ What It Does

- **Reflective journaling** — a distraction-free rich-text editor (Quill.js) for daily entries.
- **Real-time linguistic feedback** — lexical diversity (type-token ratio), tone-word ratios, and repeated/emotion-word extraction computed on every save.
- **Personal baseline tracking** — each entry's sentiment score is compared against the user's own historical mean (`computeSentimentBaseline`, μ_user), reported as a z-score deviation (`computePersonalBaselineDelta`), alongside a separate fixed-reference comparison against a constant population point (mean 50, stdDev 15, `computePopulationDelta`) shown side-by-side on the dashboard.
- **Longitudinal mood modelling** — a recurrent (LSTM-architecture) model maintains a per-user hidden/cell state across entries and attends back over recent history to classify the current trend (stable / declining / improving / cyclical), with a deterministic OLS-regression fallback when the model call is unavailable.
- **Hyperbole-aware crisis screening** — a client-side, negation-aware lexicon distinguishes figurative catastrophizing ("this ruined my whole week") from genuine acute-risk language before anything reaches the AI or an escalation banner.
- **LLM output moderation** — every AI reply is checked against a moderation pass before being shown; an unsafe verdict triggers one regeneration attempt, with a fixed safe template as the final fallback (`ethical_guardrail.js` + `analyze-journal`'s `mode=moderate`).
- **Nook AI companion** — a chat interface whose system prompt is rebuilt per conversation from the live values of all five framework layers, so its tone is derived from the user's actual current state.
- **Configurable + adaptive sensitivity** — users set their own false-positive/false-negative cost trade-off during onboarding through a calibration wizard (live τ* preview), and the underlying utility weights nudge automatically within fixed bounds based on the user's own feedback history, with one-click revert to defaults.
- **Explanations and feedback** — every AI response can be expanded into its layer-by-layer reasoning, with a "this doesn't seem right" flag that records which layer the user disagreed with.
- **Privacy controls** — five inference scopes (sentiment, pragmatic, temporal, goal inference, full-history chat access) can each be switched off independently, a self-serve data export, and a confirmation-gated permanent data deletion that leaves the account intact.
- **Self-evaluation dashboard** — a research view computing false-intervention rate, missed-support rate, perceived appropriateness, and an autonomy-preservation proxy from the user's own feedback and escalation history.
- **Longitudinal analytics** — a dashboard (Chart.js) visualising mood timelines, tone breakdowns, and trend direction across a user's entry history.
- **Vocabulary and growth tools** — a vocabulary builder and a freeform canvas page alongside the core journaling flow.
- **Accessibility pass** — the explanation panel, consent toggles, crisis banner, goal-clarification dialog, and calibration wizard have focus trapping, `aria-live` announcements, and keyboard-operable controls (`a11y_utils.js`); this has not yet been extended to every page in the app.

---

## 🧠 Five-Layer Framework

| Layer | Function | Implementation |
|---|---|---|
| L1 — Sentiment Detection | Polarity + numeric score (0–100) | Client lexicon + LLM enrichment |
| L2 — Pragmatic Analysis | Speech-act classification (assertion / expression / help-seeking / question) | `classifyPragmatic()` (client, lexical) + async LLM enrichment via `pragmatic-analysis` |
| L3 — Temporal Pattern Recognition | Per-user recurrent trend model with attention over recent history | `temporal-lstm` edge function (deterministically seeded weights — Mulberry32, seed `1337`; see Limitations), with an OLS-regression fallback in `personal_baseline.js` when the model call fails or is unauthenticated |
| L4 — Goal Alignment | Scoring against user-stated goals (typed explicit/implicit/meta), with a clarification loop for low-confidence inferred goals | `computeGoalAlignment()` + `user_goals` table + `goal_clarification.js` |
| L5 — Utility-Based Action Selection | Response directive under a configurable, feedback-adjusted cost asymmetry τ* = C_fp / (C_fp + C_fn) | `buildUtilityScore()` + `applyEthicalFilter()`, with weights nudged server-side by `preference-learning` |

All five outputs are persisted per entry and used to construct the Nook AI system prompt dynamically.

---

## 🛡️ Safety and Privacy Layer

These sit around the five-layer framework rather than inside it, and are as load-bearing for a system that reads people's private reflections as the analytical layers themselves:

| Component | What it does |
|---|---|
| `crisis_screen.js` | Client-side, negation-aware lexicon match for acute-risk phrasing; does not call an LLM, so it works even if the network is unavailable |
| `hyperbole_lexicon.js` | Distinguishes superlative/absolutist figurative language ("worst day ever") from literal risk statements, reducing false escalation on ordinary venting |
| `crisis_banner.js` + escalation logging | Renders an acute-risk banner with crisis resources, or a softer pattern-level note for sustained low mood |
| `ethical_guardrail.js` + moderation prompt in `analyze-journal` | Every AI-generated reply is passed back through the LLM in a moderation pass before display; an unsafe verdict triggers one regeneration attempt, then falls back to a fixed safe template |
| `user_consent_scopes` + Privacy Center | Sentiment, pragmatic, temporal, goal-inference, and full-history-chat-access are each independently toggleable; turning one off stops that computation, it doesn't just hide the output |
| `privacy-export` / `privacy-delete` edge functions | Full export of entries, goals, preferences, and every analysis layer; deletion requires a confirmation step server-side, cascading across all user-linked tables while leaving the auth account active |
| `preference-learning` edge function | Reads the user's feedback history; once enough events exist, nudges `w_task` / `w_safety` / `lambda_autonomy` / `cfp_weight` / `cfn_weight` by a fixed ±0.02 step per direction, clamped to hand-set bounds — a bounded heuristic adjustment, not a trained model |
| `research-metrics` edge function + Research view | Computes false-intervention rate, missed-support rate, perceived appropriateness, and an autonomy-preservation proxy from the user's own feedback/escalation rows — explicitly single-user descriptive statistics, not a validation study |
| `a11y_utils.js` | Shared focus-trap and `aria-live` helpers applied to the explanation panel, consent toggles, crisis banner, goal-clarification dialog, and calibration wizard |

---

## 🏗️ System Architecture

```
User Entry (Quill Rich Text Editor)
        │
        ▼
  [Client-Side NLP — personal_baseline.js]
  ├── Tokenisation, TTR, tone classification (negation-aware, phrase matching)
  ├── Individual baseline: μ_user = mean(sentiment_scores), Δ_personal = z-score vs μ_user
  ├── Fixed-reference comparison against a constant population point (mean 50, stdDev 15)
  ├── L2: Pragmatic classification (assertion / expression / help-seeking / question)
  ├── L3: temporal-lstm call (hidden/cell state per user) → OLS regression fallback
  ├── L4: Goal alignment vs typed user_goals
  └── L5: τ* = C_fp / (C_fp + C_fn); applyEthicalFilter()
        │
        ├──▶ [crisis_screen.js] acute-risk phrase check (client-side, no network dependency)
        │         │
        │         ▼
        │   [crisis_banner.js] acute / pattern escalation
        ▼
  [Edge Function: analyze-journal — Deno / Supabase]
  ├── mode=analysis  → structured per-entry analysis record
  ├── mode=chat      → Nook AI via dynamic system prompt (all 5 layers)
  ├── mode=moderate  → safety pass on generated replies (ethical_guardrail.js caller)
  └── mode=insights  → AI growth cards for the analytics dashboard
        │
        ▼
  [Edge Function: pragmatic-analysis — Deno / Supabase]
  ├── Validates the caller's Supabase JWT via supabase.auth.getUser() before any inference
  ├── Enriches L2 (pragmatic) and L4 (goal alignment) via Groq (llama-3.3-70b-versatile, temp 0.2)
  └── Recomputes L5 (utility action) server-side from the enriched values
        │
        ▼
  [Edge Functions: temporal-lstm · preference-learning · research-metrics · privacy-export · privacy-delete · user-history]
        │
        ▼
  [Supabase PostgreSQL]
  ├── Structured analysis record per entry
  ├── user_goals (typed: explicit / implicit / meta), user_temporal_state (LSTM hidden/cell state)
  ├── user_consent_scopes, escalation events, action_feedback, explanation_feedback, moderation_events
  ├── user_preferences: goals, C_fp, C_fn, utility weights, intervention_preference
  └── Row-Level Security on every user-scoped table
```

> **Graceful degradation:** if any LLM or model-serving call fails or is still pending, every framework layer falls back to a client-computed local value, so the UI never blocks on a network round-trip.

---

## 🔬 Client-Side NLP Module (`personal_baseline.js`)

Computed independently of the LLM on every entry save, so the app has usable output even before (or if) any network call returns:

- **Type-Token Ratio (TTR):** lexical diversity index
- **Tone word ratio:** positive / negative / neutral counts via custom lexicons, with phrase-level matching for help-seeking and expressive speech
- **Individual baseline deviation:** `computeSentimentBaseline()` computes μ_user from entry history; `computePersonalBaselineDelta()` returns the current entry's z-score deviation from it
- **Fixed population reference:** `computePopulationDelta()` compares the current score against a constant reference point (`{ mean: 50, stdDev: 15 }` in `baseline_constants.js`) rather than any measured population — shown on the dashboard alongside the personal baseline, not in place of it
- **L2 pragmatic classification:** `classifyPragmatic()` — sentence-level speech-act detection via lexical pattern matching, no LLM required
- **L3 temporal trend:** calls the `temporal-lstm` edge function when authenticated, falling back to a local OLS slope comparison when it isn't
- **L4 goal alignment:** `computeGoalAlignment()` — weighted scoring against goals synced from the typed `user_goals` table, with `goal_clarification.js` prompting the user directly when an inferred goal has low confidence
- **L5 utility score:** `buildUtilityScore()` computes τ* and a bounded utility value from sentiment, trend, goal, and pragmatic signals; `applyEthicalFilter()` overrides the resulting action to prevent clinical/diagnostic response labels and to suppress intervention when entry history is too short or sentiment isn't actually negative

---

## 🎚️ Configurable + Adaptive AI Sensitivity (C_fp / C_fn)

Users set asymmetric misclassification costs through a calibration wizard during onboarding (also revisitable from the Privacy Center), which shows the resulting τ* and a worked example of which action it would select before the user commits:

| Setting | C_fp | C_fn | τ* | Effect |
|---|---|---|---|---|
| Minimal | 0.6 | 0.4 | 0.60 | Conservative; rarely suggests support |
| Balanced (default) | 0.4 | 0.6 | 0.40 | Standard intervention threshold |
| Proactive | 0.25 | 0.75 | 0.25 | Earlier support on negative patterns |

Beyond the initial choice, `preference-learning` reads the user's own feedback history and nudges `cfp_weight`, `cfn_weight`, and the utility weights (`w_task`, `w_safety`, `lambda_autonomy`) by a fixed `±0.02` step within hand-set bounds — repeated negative feedback on `intervene`/`support` actions gradually raises the bar for intervention, and vice versa. This is a bounded heuristic adjustment on top of user-set defaults, not a trained model, and a one-click "revert to defaults" is always available.

---

## 🤖 LLM Configuration

| Property | Value |
|---|---|
| Model | `llama-3.3-70b-versatile` via Groq |
| Deployment | Supabase Edge Functions (Deno runtime) |
| Temperature | `0` for moderation, `0.2` for L2/L4 enrichment (`pragmatic-analysis`), `0.3` for insight generation, `0.7` for Nook AI chat |
| Auth on inference calls | Every edge function that touches the LLM or the database requires a valid Supabase JWT (`supabase.auth.getUser()`) before proceeding |

---

## ✅ Automated Testing

A Vitest suite covers the pieces of the framework where a subtle regression would be easy to miss and hard to notice by eye, using mocked Groq responses so it runs deterministically with no live API calls:

```
✓ tests/integration/pragmatic_analysis.test.js  (5 tests)
✓ tests/unit/goal_alignment.test.js             (10 tests)
✓ tests/unit/hyperbole_guard.test.js            (6 tests)
✓ tests/unit/utility_decomposition.test.js      (7 tests)
✓ tests/unit/temporal_pattern.test.js           (7 tests)

Test Files  5 passed (5)
     Tests  35 passed (35)
```

Fixtures live in `Frontend/tests/fixtures/groq_responses/`; `tests/support/load_frontend.js` loads the plain-`window`-global frontend modules into Node via `require()`, and `tests/support/setup.js` shims `localStorage` and resets it between tests.

```bash
cd Frontend
npm install
npm test
```

---

## 🧩 Key Design Decisions

| Component | Choice | Rationale |
|---|---|---|
| Client-first computation | All five layers have a local, non-LLM fallback | The app degrades gracefully instead of blocking on network/inference latency |
| Async enrichment | `pragmatic-analysis` runs as a non-blocking post-save call | L2/L4 refinement doesn't delay the entry save response |
| Per-user baselining | μ_user computed from the user's own history, shown alongside a fixed reference point rather than replacing it | A "negative" entry is judged against what's normal *for that person*, with a simple constant for orientation |
| Utility framing for L5 | Cost-asymmetric threshold (τ*) rather than a fixed sentiment cutoff | Lets the user tune how proactively the system offers support, instead of hard-coding one answer |
| Bounded feedback adjustment over full ML training | `preference-learning` nudges weights within fixed bounds from a rolling feedback window | A transparent, reversible, auditable adjustment rather than an opaque model retrain on a single user's sparse signal |
| Layered safety checks (client screen → moderation pass → fallback template) | No single point of failure decides whether a reply is safe to show | Client-side crisis screening survives network loss; server-side moderation catches what the lexicon can't |
| Row-Level Security everywhere | Enforced on every user-scoped table | Per-user data isolation is enforced at the database layer, not just in application code |

---

## 🔒 Security

- Row-Level Security is enabled on every user-scoped table, with per-user policies and cascading foreign keys to `auth.users(id)`.
- Every edge function that performs inference or touches user data validates the caller's Supabase JWT before doing anything else.
- Data deletion requires a server-side confirmation step, not just a client-side button click.
- The Supabase anon key is a public, RLS-scoped key by design and safe to ship client-side. The Groq key lives only in edge function environments (`supabase secrets set GROQ_API_KEY=...`). `Frontend/env.js` (holding the Supabase URL/anon key) is generated at build time by `generate-env.js` from environment variables and is excluded via `.gitignore`, along with `node_modules/` and `package-lock.json`.

---

## ⚠️ Limitations

- **L3 model weights are fixed, not learned:** the LSTM-architecture forward pass in `temporal-lstm` uses deterministically seeded (Mulberry32, seed `1337`) weight matrices, not weights trained via backpropagation on labelled sequences. It provides a real recurrent computation and attention-weighted historical context, but should be read as a structured, reproducible feature extractor rather than a trained sequence model. The OLS-regression fallback remains the mathematically simpler, fully interpretable alternative.
- **Preference learning is a heuristic, not model training:** `preference-learning` applies a fixed `±0.02` step per feedback direction within hand-set bounds. It adapts to the user but does not fit a model to their feedback data in any statistical sense.
- **The population comparison is a constant, not a measured norm:** `computePopulationDelta()` compares against a hardcoded `{ mean: 50, stdDev: 15 }`, not a value derived from real aggregate user data.
- **LLM non-determinism:** repeated analysis of the same entry may return slightly different sentiment labels due to temperature.
- **Lexicon coverage:** hand-curated word sets (sentiment, hyperbole, crisis-phrase) miss domain-specific or culturally nuanced expressions; a distributional lexicon (e.g. NRC Emotion Lexicon) would improve recall.
- **TTR length sensitivity:** TTR decreases as text length increases; MATTR or MTLD would be more robust for cross-entry vocabulary comparison.
- **Pragmatic enrichment timing:** the enriched result is written asynchronously — the sentiment page may briefly display local heuristic values before the write completes.
- **No multi-user validation:** the Research view's metrics are single-user descriptive statistics computed from that user's own feedback, not results from a controlled study with a labelled ground truth across multiple users.
- **Crisis and hyperbole detection are lexicon-based:** they are a first-pass safety net, not a clinical screening tool, and are not a substitute for professional support — the in-app crisis banner is explicit about this.
- **Accessibility pass is partial:** focus-trapping, `aria-live` regions, and keyboard operability have been applied to the explanation panel, consent toggles, crisis banner, goal-clarification dialog, and calibration wizard, but not yet to the rest of the app's pages.

---

## 🚀 Future Work

- Replace the fixed-weight L3 model with one actually trained (via backpropagation) on labelled longitudinal mood sequences, and/or replace TTR with Moving-Average TTR (MATTR) to control for text length.
- Fine-tune a smaller classification model (e.g. DistilBERT) on journal-domain data for consistent L1 classification with calibrated probability output.
- Formal accuracy evaluation against a labelled, multi-user held-out set to complement the current single-user descriptive metrics in the Research view.
- Replace the fixed-step preference nudging with a proper online-learning method (e.g. contextual bandit) fit across a larger feedback dataset.
- Named entity and topic extraction to surface recurring themes across entries in the analytics dashboard.
- Privacy-preserving personalisation via federated learning and on-device processing.
- Multi-language support extending the lexicon and prompt pipeline to non-English entries.
- Extend the accessibility pass already applied to the explanation/consent/calibration surfaces to the remaining pages, and add automated axe-core checks to the test suite.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript, Quill.js |
| AI Inference | LLaMA 3.3 70B via Groq API |
| Backend / API | Deno Edge Functions on Supabase (`analyze-journal`, `pragmatic-analysis`, `temporal-lstm`, `preference-learning`, `research-metrics`, `privacy-export`, `privacy-delete`, `user-history`) |
| Database | Supabase PostgreSQL with RLS on every user-scoped table |
| Client NLP | Custom lexicons (sentiment, hyperbole, crisis-phrase) + negation detection + `personal_baseline.js` (5-layer framework) |
| Testing | Vitest (35 unit + integration tests, mocked Groq fixtures) |
| Visualisation | Chart.js (mood timeline, tone chart, action distribution) |
| Auth | Supabase Auth (email) with row-level security |

---

## ⚙️ Local Setup

**Prerequisites:** Supabase account · Groq API key · Supabase CLI (`npm install -g supabase`) · Node.js (for the test suite)

**1. Clone**
```bash
git clone https://github.com/yamini-nlp/MindNook-HCJ.git
cd MindNook-HCJ
```

**2. Run migrations**

Apply every file in `supabase/migrations/` in order via the Supabase SQL Editor or `supabase db push`. Each migration is idempotent (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS` before `CREATE POLICY`), so they're safe to re-run.

**3. Deploy edge functions**
```bash
supabase login
supabase link --project-ref your-project-ref
supabase secrets set GROQ_API_KEY=your_groq_key_here
supabase functions deploy analyze-journal
supabase functions deploy pragmatic-analysis
supabase functions deploy temporal-lstm
supabase functions deploy preference-learning
supabase functions deploy research-metrics
supabase functions deploy privacy-export
supabase functions deploy privacy-delete
supabase functions deploy user-history
```

**4. Generate the frontend env file and run locally**
```bash
cd Frontend
SUPABASE_URL=your_url SUPABASE_ANON_KEY=your_anon_key npm run build
python3 -m http.server 5500
# or: right-click index.html in VS Code → Open with Live Server
```
Navigate to `http://localhost:5500/index.html`

**5. Run the test suite**
```bash
cd Frontend
npm install
npm test
```

**6. Deploy to Vercel**

Connect the GitHub repository, set the project root to `Frontend`, and set `SUPABASE_URL` / `SUPABASE_ANON_KEY` as environment variables so `npm run build` can generate `env.js` at deploy time.

> ⚠️ The Supabase anon key is safe to expose client-side (public key); RLS enforces per-user isolation. The Groq key must never appear in frontend source — set it only via `supabase secrets set`.

---

## 📁 Repository Structure

```
MindNook-HCJ/
├── .gitattributes
├── LICENSE
├── README.md
├── sentiment_aware_framework.pdf      # Published preprint
│
├── Frontend/
│   ├── .gitignore                    # Excludes env.js, node_modules/, package-lock.json
│   ├── package.json                  # devDependency: vitest ^2.1.4
│   ├── vitest.config.js              # include: tests/**/*.test.js
│   ├── generate-env.js               # Writes env.js from SUPABASE_URL / SUPABASE_ANON_KEY at build time
│   ├── vercel.json
│   │
│   ├── index.html · login.html · onboarding.html · dashboard.html
│   ├── analysis.html · sentiment.html · history.html · vocab.html · canvas.html
│   ├── nook-ai.html · privacy_center.html · research_insights.html
│   │
│   ├── app.js                        # Feature grid + core UI logic
│   ├── auth.js                       # Supabase auth handling
│   ├── personal_baseline.js          # Five-layer client NLP module
│   ├── baseline_constants.js         # Fixed population reference point (mean 50, stdDev 15)
│   ├── lstm_temporal.js              # L3 recurrent-model client caller
│   ├── utility_decomposition.js      # L5 utility/action-selection math
│   ├── ethical_guardrail.js          # LLM output moderation + regeneration
│   ├── crisis_screen.js              # Client-side, negation-aware acute-risk phrase detection
│   ├── crisis_banner.js              # Acute/pattern escalation UI
│   ├── crisis_resources.json         # Crisis-line data
│   ├── hyperbole_lexicon.js          # Figurative-language guard
│   ├── goal_clarification.js         # Low-confidence goal confirmation flow
│   ├── explanation_panel.js/.css     # Per-response layer-by-layer explanation UI
│   ├── feedback_controls.js          # Thumbs up/down + adjustment notice
│   ├── calibration_wizard.js/.css    # τ*/utility-weight calibration UI
│   ├── sidebar_nav.js/.css           # Shared navigation
│   ├── shared-components.css · design-tokens.css
│   ├── a11y_utils.js                 # Shared focus-trap / aria-live helpers
│   ├── tests/
│   │   ├── unit/
│   │   │   ├── goal_alignment.test.js         (10 tests)
│   │   │   ├── hyperbole_guard.test.js        (6 tests)
│   │   │   ├── temporal_pattern.test.js       (7 tests)
│   │   │   └── utility_decomposition.test.js  (7 tests)
│   │   ├── integration/
│   │   │   └── pragmatic_analysis.test.js     (5 tests)
│   │   ├── support/
│   │   │   ├── load_frontend.js      # require()s the window-global frontend modules into Node
│   │   │   └── setup.js              # localStorage shim + per-test reset
│   │   └── fixtures/groq_responses/
│   │       ├── catharsis.json
│   │       ├── distress_call.json
│   │       ├── hyperbole_minor_inconvenience.json
│   │       └── toy_validation_example.json
│   └── images/
│       ├── mindnook-logo.ico · mindnook.jpeg
│       └── 1.jpeg · 2.jpeg · 3.jpeg · 4.jpeg
│
└── supabase/
    ├── functions/
    │   ├── analyze-journal/          # mode: analysis / chat / insights / moderate
    │   │   ├── deno.json · index.ts · moderation_prompt.ts
    │   ├── pragmatic-analysis/       # Groq call (temp 0.2) + JWT check
    │   │   ├── deno.json · index.ts · handler.ts · core_logic.ts
    │   ├── temporal-lstm/            # LSTM forward pass, seeded weights, attention
    │   │   ├── deno.json · index.ts
    │   ├── preference-learning/      # Bounded ±0.02-step weight nudging
    │   │   ├── deno.json · index.ts
    │   ├── research-metrics/         # Self-evaluation metrics
    │   │   ├── deno.json · index.ts
    │   ├── privacy-export/
    │   │   ├── deno.json · index.ts
    │   ├── privacy-delete/           # Confirmation-gated deletion
    │   │   ├── deno.json · index.ts
    │   └── user-history/
    │       ├── deno.json · index.ts
    │
    └── migrations/                   # 16 files, idempotent
        ├── Journal entries table.sql
        ├── Add Layered JSONB Fields with GIN Indexes.sql
        ├── Add sentiment and preference fields.sql
        ├── RLS Policies.sql
        ├── user_preferences.sql
        ├── goal_typing.sql            # user_goals table (explicit/implicit/meta)
        ├── layer3_lstm.sql            # user_temporal_state (LSTM hidden/cell state)
        ├── layer5_utility.sql         # w_task/w_safety/lambda_autonomy columns
        ├── crisis_escalation.sql      # escalation events
        ├── hyperbole_detection.sql    # hyperbole flag/score columns
        ├── moderation_events.sql
        ├── explanation_feedback.sql
        ├── privacy_consent.sql        # user_consent_scopes table
        ├── preference_learning.sql    # action_feedback table
        ├── history_metadata.sql       # metadata column + get_user_history() function
        └── research_metrics_indexes.sql
```

---

<div align="center">

*Built by Yamini G · [GitHub](https://github.com/yamini-nlp/MindNook-HCJ) · [Preprint](https://doi.org/10.36227/techrxiv.177274130.07417144/v1)*

</div>
