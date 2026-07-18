window.MindNookCrisisScreen = (function () {
  const ACUTE_PHRASES = [
    'kill myself', 'killing myself', 'end my life', 'ending my life',
    'want to die', 'wish i was dead', 'wish i were dead', 'wish i were gone',
    'suicidal', 'suicide', 'no reason to live', 'better off dead',
    'not worth living', "can't go on", 'cant go on', 'hurt myself',
    'hurting myself', 'harming myself', 'self harm', 'self-harm',
    'cutting myself', 'overdose on', 'take all my pills', 'planning to die',
    'going to kill myself', 'ready to die', 'no point in living'
  ];

  const NEGATION_MARKERS = [
    'not', 'never', 'no longer', 'stopped', 'used to', 'anymore',
    "wouldn't", 'would not', "don't want to", 'do not want to', "isn't",
    'is not', 'not going to'
  ];

  function hasNegationNearby(lowerText, idx) {
    const windowStart = Math.max(0, idx - 40);
    const context = lowerText.slice(windowStart, idx);
    return NEGATION_MARKERS.some(m => context.includes(m));
  }

  function screenForAcuteRisk(text) {
    if (!text || typeof text !== 'string') return { triggered: false, confidence: 0 };
    const lower = text.toLowerCase();
    let hits = 0;
    ACUTE_PHRASES.forEach(phrase => {
      let idx = lower.indexOf(phrase);
      while (idx !== -1) {
        if (!hasNegationNearby(lower, idx)) hits++;
        idx = lower.indexOf(phrase, idx + phrase.length);
      }
    });
    if (hits === 0) return { triggered: false, confidence: 0 };
    const confidence = Math.min(1, 0.55 + hits * 0.15);
    return { triggered: true, confidence: +confidence.toFixed(2) };
  }

  return { screenForAcuteRisk };
})();