window.MindNookBaseline = (function () {
  function classifyPragmatic(text) {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 4);
    let questionCount = 0, helpCount = 0, assertCount = 0, expressCount = 0;
    const helpPhrases = ['i need', 'i want', 'help me', 'how do i', 'what should', 'i wish', 'i hope', 'please', 'can i', 'should i'];
    const expressPhrases = ['i feel', 'i felt', 'i am feeling', 'i was feeling', "i'm", "i've been", 'i was', 'i am', 'makes me', 'i love', 'i hate', 'i miss', 'i fear', 'i enjoy'];
    sentences.forEach(s => {
      const st = s.trim().toLowerCase();
      if (st.endsWith('?') || /^(what|why|how|when|where|who|is|are|do|did|can|could|would|should)\b/.test(st)) {
        questionCount++;
      } else if (helpPhrases.some(p => st.includes(p))) {
        helpCount++;
      } else if (expressPhrases.some(p => st.includes(p))) {
        expressCount++;
      } else {
        assertCount++;
      }
    });
    const total = sentences.length || 1;
    const dominant = [
      { type: 'question', count: questionCount },
      { type: 'help-seeking', count: helpCount },
      { type: 'expression', count: expressCount },
      { type: 'assertion', count: assertCount },
    ].sort((a, b) => b.count - a.count)[0].type;
    return {
      dominant,
      distribution: {
        assertion: Math.round(assertCount / total * 100),
        expression: Math.round(expressCount / total * 100),
        helpSeeking: Math.round(helpCount / total * 100),
        question: Math.round(questionCount / total * 100),
      }
    };
  }

  function computeNumericSentimentScore(e) {
    if (e.sentiment_score != null) return e.sentiment_score;
    const posCount = e.positive_word_count || 0;
    const negCount = e.negative_word_count || 0;
    const wordCount = e.word_count || 1;
    if (posCount > 0 || negCount > 0) {
      const score = 50 + ((posCount - negCount) / wordCount) * 50;
      return Math.max(0, Math.min(100, Math.round(score)));
    }
    if (!e.sentiment) return 50;
    const s = e.sentiment.toLowerCase();
    if (s.includes('positive')) return 75;
    if (s.includes('negative')) return 25;
    return 50;
  }

  function computeOLSSlope(arr) {
    const n = arr.length;
    if (n < 2) return 0;
    const xMean = (n - 1) / 2;
    const yMean = arr.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    arr.forEach((y, x) => { num += (x - xMean) * (y - yMean); den += (x - xMean) ** 2; });
    return den !== 0 ? num / den : 0;
  }

  function computeVariance(arr) {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((acc, s) => acc + (s - mean) ** 2, 0) / arr.length;
  }

  function classifyTemporalTrendFallback(entries) {
    if (!entries || entries.length < 3) return { label: 'insufficient data', direction: 'neutral', slope: 0, variance: 0, scores: [], attentionWeights: [], method: 'multi-window-regression' };
    const scores = entries.slice(0, 20).reverse().map(e => computeNumericSentimentScore(e));
    const slope = computeOLSSlope(scores);
    const variance = computeVariance(scores);
    const shortWindow = scores.slice(-3);
    const longWindow = scores.slice(-Math.min(10, scores.length));
    const shortMean = shortWindow.reduce((a, b) => a + b, 0) / shortWindow.length;
    const longMean = longWindow.reduce((a, b) => a + b, 0) / longWindow.length;
    const recentSlope = scores.length >= 5 ? computeOLSSlope(scores.slice(-5)) : slope;
    const olderSlope = scores.length >= 10 ? computeOLSSlope(scores.slice(0, Math.max(5, scores.length - 5))) : slope;
    let label, direction;
    if (olderSlope < -1 && Math.abs(recentSlope) < 0.5) {
      label = 'stabilizing';
      direction = 'mixed';
    } else if (variance >= 200 && Math.abs(slope) < 1) {
      label = 'cyclical';
      direction = 'mixed';
    } else if (slope >= 1) {
      label = 'improving';
      direction = 'up';
    } else if (slope <= -1) {
      label = 'declining';
      direction = 'down';
    } else {
      label = 'stable';
      direction = 'neutral';
    }
    const attentionWeights = scores.map((_, i) => {
      const expSum = scores.reduce((a, _, j) => a + Math.exp(j / scores.length), 0);
      return Math.exp(i / scores.length) / expSum;
    });
    return {
      label,
      slope: +slope.toFixed(2),
      variance: +variance.toFixed(1),
      direction,
      scores,
      attentionWeights,
      shortMean: +shortMean.toFixed(1),
      longMean: +longMean.toFixed(1),
      method: 'multi-window-regression'
    };
  }

  async function classifyTemporalTrend(entries, ctx) {
    if (!entries || entries.length < 3) return classifyTemporalTrendFallback(entries);
    if (!ctx || !window.MindNookLSTM) return classifyTemporalTrendFallback(entries);
    try {
      return await window.MindNookLSTM.callTemporalLSTM(ctx, entries);
    } catch (e) {
      console.warn('LSTM temporal classification failed, using fallback:', e.message);
      return classifyTemporalTrendFallback(entries);
    }
  }

  function getTauGoal() {
    const stored = parseFloat(localStorage.getItem('mindnook_tau_goal'));
    return Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : 0.6;
  }

  function pickLowConfidenceGoal(typedGoals) {
    if (!Array.isArray(typedGoals) || !typedGoals.length) return null;
    const tauGoal = getTauGoal();
    const pending = typedGoals.filter(g => g && g.status === 'pending_confirmation' && g.confidence != null && g.confidence < tauGoal);
    if (!pending.length) return null;
    const lowest = pending.reduce((a, b) => (b.confidence < a.confidence ? b : a));
    return { id: lowest.id, text: lowest.text, confidence: lowest.confidence };
  }

  function computeGoalAlignment(analysisResult, entries, typedGoals) {
    const hasTypedGoals = Array.isArray(typedGoals);
    const activeTypedGoals = hasTypedGoals ? typedGoals.filter(g => g && g.status === 'active') : null;
    const storedGoals = hasTypedGoals
      ? activeTypedGoals.map(g => g.text)
      : JSON.parse(localStorage.getItem('mindnook_goals') || '[]');
    const lowConfidenceGoal = hasTypedGoals ? pickLowConfidenceGoal(typedGoals) : null;
    const storedEmotions = JSON.parse(localStorage.getItem('mindnook_emotions') || '[]');
    const stressLevel = parseInt(localStorage.getItem('mindnook_stress') || '5');
    if (!storedGoals.length) {
      const base = { score: null, label: 'No goals set', detail: 'Complete onboarding to enable goal alignment.' };
      return lowConfidenceGoal ? { ...base, lowConfidenceGoal } : base;
    }
    let score = 50;
    const sentiment = (analysisResult && analysisResult.sentiment) || 'Neutral';
    const ld = (analysisResult && analysisResult.lexicalDiversity) || 0;
    const wordCount = (analysisResult && analysisResult.wordCount) || 0;
    storedGoals.forEach(goal => {
      const g = goal.toLowerCase();
      if (g.includes('emotion') || g.includes('self-aware')) {
        if (sentiment === 'Positive') score += 10;
        score += Math.min(10, (analysisResult && analysisResult.positiveWordCount) || 0);
      }
      if (g.includes('stress') || g.includes('burnout')) {
        if (stressLevel < 5 && sentiment !== 'Negative') score += 15;
        if (sentiment === 'Negative') score -= 10;
      }
      if (g.includes('writing') || g.includes('vocab') || g.includes('clarity')) {
        score += Math.round(ld * 30);
        if (wordCount > 200) score += 10;
      }
      if (g.includes('habit') || g.includes('daily')) {
        if (entries && entries.length > 0) {
          const today = new Date().toDateString();
          const wroteTodayBefore = entries.slice(1).some(e => new Date(e.created_at).toDateString() === today);
          score += wroteTodayBefore ? 5 : 15;
        }
      }
      if (g.includes('grow') || g.includes('measure')) {
        if (entries && entries.length >= 5) score += 10;
      }
      if (g.includes('thought') || g.includes('organis') || g.includes('organiz')) {
        const pragmatic = classifyPragmatic((analysisResult && analysisResult._rawText) || '');
        if (pragmatic.dominant === 'assertion') score += 12;
      }
    });
    const negEmotions = ['anxious', 'overwhelmed', 'burned out', 'disconnected'];
    const currentlyNegative = storedEmotions.some(e => negEmotions.includes(e.toLowerCase()));
    if (currentlyNegative && sentiment === 'Positive') score += 15;
    score = Math.max(0, Math.min(100, Math.round(score)));
    let label, detail;
    if (score >= 75) { label = 'Strongly aligned'; detail = 'This entry resonates well with your journaling goals.'; }
    else if (score >= 50) { label = 'Partially aligned'; detail = 'Some elements of this entry support your goals.'; }
    else if (score >= 25) { label = 'Loosely aligned'; detail = 'This entry diverges somewhat from your stated goals.'; }
    else { label = 'Misaligned'; detail = 'This entry may reflect unresolved tension with your goals.'; }
    const result = { score, label, detail, goals: storedGoals };
    return lowConfidenceGoal ? { ...result, lowConfidenceGoal } : result;
  }

  async function fetchTypedGoals(supabaseClient, userId) {
    if (!supabaseClient || !userId) return null;
    try {
      const { data, error } = await supabaseClient
        .from('user_goals')
        .select('id,text,type,confidence,source,status')
        .eq('user_id', userId)
        .in('status', ['active', 'pending_confirmation']);
      if (error || !data) return null;
      return data;
    } catch (e) {
      console.warn('Could not fetch typed goals:', e);
      return null;
    }
  }

  function computeBaselineDelta(currentAnalysis, entries) {
    if (!entries || entries.length < 3) return null;
    const recentEntries = entries.slice(1, 6);
    const avgWords = recentEntries.reduce((a, e) => a + (e.word_count || 0), 0) / recentEntries.length;
    const avgLex = recentEntries.reduce((a, e) => a + (parseFloat(e.lexical_diversity) || 0), 0) / recentEntries.length;
    const avgRead = recentEntries.reduce((a, e) => a + (parseInt(e.readability) || 50), 0) / recentEntries.length;
    return {
      wordsDelta: (currentAnalysis.wordCount || 0) - Math.round(avgWords),
      lexDelta: +((currentAnalysis.lexicalDiversity || 0) - avgLex).toFixed(2),
      readDelta: (currentAnalysis.readability || 50) - Math.round(avgRead),
      baseline: { avgWords: Math.round(avgWords), avgLex: +avgLex.toFixed(2), avgRead: Math.round(avgRead) }
    };
  }

  function computeSentimentBaseline(entries) {
    if (!entries || entries.length < 3) return null;
    const scores = entries.map(e => computeNumericSentimentScore(e));
    const muUser = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((acc, s) => acc + (s - muUser) ** 2, 0) / scores.length;
    return {
      muUser: +muUser.toFixed(2),
      variance: +variance.toFixed(2),
      stdDev: +Math.sqrt(variance).toFixed(2),
      sampleSize: scores.length
    };
  }

  function computePersonalBaselineDelta(currentScore, baseline) {
    if (!baseline) return null;
    const delta = currentScore - baseline.muUser;
    const normalizedDelta = delta / (baseline.stdDev || 1);
    return {
      delta: +delta.toFixed(2),
      zScore: +normalizedDelta.toFixed(2),
      interpretation: normalizedDelta > 1 ? 'significantly above baseline' : normalizedDelta < -1 ? 'significantly below baseline' : 'within normal range'
    };
  }

  function buildUtilityScore(l1, l2, l3, l4, userPreferences, entryHistory) {
    const weights = {
      w_task: userPreferences?.w_task ?? 0.4,
      w_safety: userPreferences?.w_safety ?? 0.35,
      lambda_privacy: userPreferences?.lambda_privacy ?? 0.15,
      lambda_autonomy: userPreferences?.lambda_autonomy ?? 0.10,
    };
    const Cfp = userPreferences?.cfp_weight ?? parseFloat(localStorage.getItem('mindnook_cfp') || '0.4');
    const Cfn = userPreferences?.cfn_weight ?? parseFloat(localStorage.getItem('mindnook_cfn') || '0.6');
    const tau = Cfp / (Cfp + Cfn);
    const autonomyPreference = userPreferences?.autonomy_preference ?? parseFloat(localStorage.getItem('mindnook_autonomy_pref') || '0.5');
    const sentimentScore = l1.sentiment === 'Positive' ? 1 : l1.sentiment === 'Negative' ? -1 : 0;
    const trendScore = l3.direction === 'up' ? 1 : l3.direction === 'down' ? -1 : 0;
    const goalScore = l4.score != null ? (l4.score - 50) / 50 : 0;
    const pIntervention = Math.max(0, Math.min(1, 0.5 - (sentimentScore * 0.3) - (trendScore * 0.2) - (goalScore * 0.1)));
    const shouldIntervene = pIntervention > tau;
    const z = { l1, l2, l3, l4, entryHistory, inferenceDepth: 0, autonomyPreference };
    const utilityModule = window.MindNookUtility;
    const actions = utilityModule ? utilityModule.ACTIONS : ['affirm', 'encourage', 'reflect', 'support', 'intervene'];
    const results = actions.map(action => ({
      action,
      ...(utilityModule ? utilityModule.computeDecomposedUtility(action, z, weights) : { utility: 0, breakdown: { appropriateness: 0, safety: 0, privacyCost: 0, autonomyCost: 0 }, weights })
    }));
    const candidates = shouldIntervene ? results : results.filter(r => r.action !== 'intervene');
    const best = candidates.reduce((a, b) => (b.utility > a.utility ? b : a));
    return {
      utility: best.utility,
      action: best.action,
      breakdown: best.breakdown,
      weights,
      tau: +tau.toFixed(2),
      pIntervention: +pIntervention.toFixed(3),
      shouldIntervene,
      allActions: results
    };
  }

  function applyEthicalFilter(action, entries, analysisResult) {
    const harmful = new Set(['clinical_diagnosis', 'medical_advice']);
    if (harmful.has(action)) return 'reflect';
    if (!entries || entries.length < 3) {
      if (action === 'intervene') return 'support';
    }
    const sentiment = (analysisResult && analysisResult.sentiment) || 'Neutral';
    if (action === 'intervene' && sentiment !== 'Negative') return 'support';
    return action;
  }

  function buildDynamicSystemPrompt(l1, l2, l3, l4, l5, journalContext) {
    const toneMap = {
      affirm: 'Be warm and celebratory. Reinforce what the user is doing well.',
      encourage: 'Be gently encouraging. Acknowledge progress while staying grounded.',
      reflect: 'Be neutral and thoughtful. Help the user explore their own patterns.',
      support: 'Be empathetic and careful. Acknowledge difficulty without amplifying it.',
      intervene: 'Be compassionate and grounding. Gently help the user reframe toward possibility. Never provide clinical diagnoses or medical advice. If persistent distress is detected over multiple entries, gently encourage seeking appropriate support.',
    };
    const safeAction = applyEthicalFilter(l5.action, null, { sentiment: l1.sentiment });
    return `You are Nook AI, an emotionally intelligent reflective companion.

CURRENT STATE ANALYSIS:
- Sentiment: ${l1.sentiment || 'Neutral'} (positive words: ${l1.positiveWordCount || 0}, negative: ${l1.negativeWordCount || 0})
- Communication style: ${l2.dominant} (${JSON.stringify(l2.distribution)})
- Trend: ${l3.label} (slope: ${l3.slope}, direction: ${l3.direction}, method: ${l3.method || 'regression'})
- Goal state: ${l4.label} (score: ${l4.score}/100) — Goals: ${(l4.goals || []).join(', ')}
- Recommended response: ${safeAction} (utility: ${l5.utility})

RESPONSE DIRECTIVE: ${toneMap[safeAction] || toneMap.reflect}

USER JOURNAL CONTEXT:
${journalContext}

Rules:
- Respond specifically to the user's communication style (${l2.dominant}): ${l2.dominant === 'question' ? 'answer their question directly' : l2.dominant === 'help-seeking' ? 'offer concrete support' : l2.dominant === 'expression' ? 'validate and reflect' : 'engage thoughtfully with their assertion'}
- Reference the trend (${l3.label}) where relevant
- Keep responses 2–4 paragraphs unless the question genuinely requires more
- Never give medical or clinical advice. Never diagnose.
- Sound like you have read every entry carefully
- If the user has shown persistently negative entries over 3 or more weeks, gently acknowledge this and encourage them to speak with someone they trust`;
  }

  async function syncGoalsFromSupabase(supabaseClient, userId) {
    const localGoals = JSON.parse(localStorage.getItem('mindnook_goals') || '[]');
    if (localGoals.length > 0) return localGoals;
    try {
      const { data, error } = await supabaseClient
        .from('user_preferences')
        .select('goals, cfp_weight, cfn_weight, w_task, w_safety, lambda_privacy, lambda_autonomy, autonomy_preference')
        .eq('user_id', userId)
        .single();
      if (!error && data?.goals) {
        localStorage.setItem('mindnook_goals', JSON.stringify(data.goals));
        if (data.cfp_weight != null) localStorage.setItem('mindnook_cfp', String(data.cfp_weight));
        if (data.cfn_weight != null) localStorage.setItem('mindnook_cfn', String(data.cfn_weight));
        if (data.w_task != null) localStorage.setItem('mindnook_w_task', String(data.w_task));
        if (data.w_safety != null) localStorage.setItem('mindnook_w_safety', String(data.w_safety));
        if (data.lambda_privacy != null) localStorage.setItem('mindnook_lambda_privacy', String(data.lambda_privacy));
        if (data.lambda_autonomy != null) localStorage.setItem('mindnook_lambda_autonomy', String(data.lambda_autonomy));
        if (data.autonomy_preference != null) localStorage.setItem('mindnook_autonomy_pref', String(data.autonomy_preference));
        return data.goals;
      }
    } catch (e) { console.warn('Goal sync failed:', e); }
    return [];
  }

  const PRAGMATIC_PHRASE_MAP = {
    assertion: 'sharing a straightforward reflection',
    expression: 'expressing how you feel',
    'help-seeking': 'looking for support or guidance',
    help_seeking: 'looking for support or guidance',
    question: 'asking a question',
    catharsis: 'processing something difficult',
    request: 'making a request',
  };

  const TREND_PHRASE_MAP = {
    stable: 'holding fairly steady',
    declining: 'trending downward recently',
    improving: 'trending upward recently',
    cyclical: 'moving in ups and downs',
    stabilizing: 'settling after some ups and downs',
  };

  const ACTION_PHRASE_MAP = {
    affirm: 'affirm what seems to be going well',
    encourage: 'gently encourage you',
    reflect: 'reflect back what you shared',
    support: 'offer some steady support',
    intervene: 'gently check in more directly',
  };

  function buildExplanation(l1, l2, l3, l4, l5) {
    if (!l1 && !l2 && !l3 && !l4 && !l5) return 'Not enough analysis data for this entry yet.';
    const sentences = [];

    const pragPhrase = (l2 && l2.dominant) ? (PRAGMATIC_PHRASE_MAP[l2.dominant] || 'sharing your thoughts') : null;
    if (l1 && l1.sentiment) {
      const sentimentPhrase = l1.sentiment === 'Positive' ? 'an uplifting tone' : l1.sentiment === 'Negative' ? 'some difficult feelings' : 'a fairly neutral tone';
      const confidencePart = l1.sentimentConfidence != null ? ` (confidence: ${Math.round(l1.sentimentConfidence * 100)}%)` : '';
      sentences.push(`I noticed your message carried ${sentimentPhrase}${confidencePart}${pragPhrase ? `, and it read like you were ${pragPhrase}` : ''}.`);
    } else if (pragPhrase) {
      sentences.push(`This reads like you were ${pragPhrase}.`);
    }

    if (l3 && l3.label && l3.label !== 'insufficient data' && TREND_PHRASE_MAP[l3.label]) {
      const attentionPhrase = (l3.attentionContributors && l3.attentionContributors.length) ? ' A few earlier entries weighed most heavily in that read.' : '';
      sentences.push(`Looking at your recent entries, things seem to be ${TREND_PHRASE_MAP[l3.label]}.${attentionPhrase}`);
    }

    if (l4 && l4.label && l4.label !== 'No goals set') {
      sentences.push(`This entry seems ${l4.label.toLowerCase()} with the goals you've set.`);
    }

    if (l5 && l5.action) {
      const actionPhrase = ACTION_PHRASE_MAP[l5.action] || 'respond thoughtfully';
      const b = l5.breakdown;
      const utilityPhrase = b ? ` This weighed appropriateness (${b.appropriateness}), safety (${b.safety}), privacy cost (${b.privacyCost}), and autonomy cost (${b.autonomyCost}).` : '';
      sentences.push(`Based on all of this, I chose to ${actionPhrase}.${utilityPhrase}`);
    }

    return sentences.length ? sentences.join(' ') : 'Not enough analysis data for this entry yet.';
  }

  return {
    classifyPragmatic,
    classifyTemporalTrend,
    classifyTemporalTrendFallback,
    computeGoalAlignment,
    fetchTypedGoals,
    getTauGoal,
    computeBaselineDelta,
    computeSentimentBaseline,
    computePersonalBaselineDelta,
    computeNumericSentimentScore,
    buildUtilityScore,
    applyEthicalFilter,
    buildDynamicSystemPrompt,
    buildExplanation,
    syncGoalsFromSupabase,
  };
})();