window.MindNookUtility = (function () {
  const ACTIONS = ['affirm', 'encourage', 'reflect', 'support', 'intervene'];

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function extractSignals(l1, l2, l3, l4) {
    const sentimentScore = l1.sentiment === 'Positive' ? 1 : l1.sentiment === 'Negative' ? -1 : 0;
    const trendScore = l3.direction === 'up' ? 1 : l3.direction === 'down' ? -1 : 0;
    const goalScore = l4.score != null ? (l4.score - 50) / 50 : 0;
    const pragScore = l2.dominant === 'help-seeking' ? 1 : l2.dominant === 'question' ? 0.5 : 0;
    return { sentimentScore, trendScore, goalScore, pragScore };
  }

  const ACTION_TARGET = { affirm: 1, encourage: 0.5, reflect: 0, support: -0.5, intervene: -1 };

  function computeAppropriateness(action, l1, l2, l3, l4) {
    const { sentimentScore, trendScore, goalScore, pragScore } = extractSignals(l1, l2, l3, l4);
    const compositeSignal = clamp(sentimentScore * 0.4 + trendScore * 0.3 + goalScore * 0.2 + pragScore * 0.1, -1, 1);
    const target = ACTION_TARGET[action] ?? 0;
    const appropriateness = clamp(1 - Math.abs(compositeSignal - target) / 2, 0, 1);
    return +appropriateness.toFixed(3);
  }

  function computeSafety(action, l1, l3, entryHistory) {
    const scores = (entryHistory || []).map(e => {
      if (e.sentiment_score != null) return e.sentiment_score;
      const s = (e.sentiment || '').toLowerCase();
      if (s.includes('positive')) return 75;
      if (s.includes('negative')) return 25;
      return 50;
    });
    const recentLow = scores.length >= 3 && scores.slice(-3).every(s => s < 35);
    const concerning = (l3.direction === 'down' && l1.sentiment === 'Negative') || recentLow;
    const gentleActions = ['support', 'intervene'];
    let safety;
    if (concerning) {
      safety = gentleActions.includes(action) ? 1 : -1;
    } else {
      safety = action === 'intervene' ? -0.3 : 0.2;
    }
    return +clamp(safety, -1, 1).toFixed(3);
  }

  const PRIVACY_DEPTH = { affirm: 0, encourage: 0, reflect: 1, support: 2, intervene: 3 };

  function computePrivacyCost(action, inferenceDepth) {
    const base = PRIVACY_DEPTH[action] ?? 1;
    const cost = clamp((base + (inferenceDepth || 0)) / 4, 0, 1);
    return +cost.toFixed(3);
  }

  const AUTONOMY_WEIGHT = { affirm: 0, encourage: 0.1, reflect: 0.2, support: 0.5, intervene: 1 };

  function computeAutonomyCost(action, userAutonomyPreference) {
    const weight = AUTONOMY_WEIGHT[action] ?? 0.2;
    const pref = userAutonomyPreference != null ? userAutonomyPreference : 0.5;
    const cost = clamp(weight * pref, 0, 1);
    return +cost.toFixed(3);
  }

  function computeDecomposedUtility(action, z, weights) {
    const appropriateness = computeAppropriateness(action, z.l1, z.l2, z.l3, z.l4);
    const safety = computeSafety(action, z.l1, z.l3, z.entryHistory);
    const privacyCost = computePrivacyCost(action, z.inferenceDepth);
    const autonomyCost = computeAutonomyCost(action, z.autonomyPreference);
    const rawUtility = weights.w_task * appropriateness + weights.w_safety * safety
      - weights.lambda_privacy * privacyCost - weights.lambda_autonomy * autonomyCost;
    const utility = +clamp(rawUtility, -1, 1).toFixed(3);
    return { utility, breakdown: { appropriateness, safety, privacyCost, autonomyCost }, weights };
  }

  return {
    ACTIONS,
    computeAppropriateness,
    computeSafety,
    computePrivacyCost,
    computeAutonomyCost,
    computeDecomposedUtility,
  };
})();