window.MindNookHyperbole = (function () {
  const SUPERLATIVE_MARKERS = [
    'worst', 'best', 'always', 'never', 'completely', 'totally', 'literally',
    'absolutely', 'entirely', 'forever', 'impossible', 'everyone', 'everything',
    'nothing', 'nobody', 'no one', 'ruined', 'destroyed', 'perfect', 'disaster',
    'hopeless', 'unbearable', 'catastrophe', 'catastrophic'
  ];

  const ABSOLUTIST_MARKERS = [
    'always', 'never', 'completely', 'totally', 'entirely', 'absolutely',
    'forever', 'impossible', 'everyone', 'everything', 'nothing', 'nobody', 'no one'
  ];

  function escapeRegex(str) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  function countMarkerHits(textLower, markers) {
    const hits = [];
    markers.forEach(m => {
      const re = new RegExp('\\b' + escapeRegex(m) + '\\b', 'g');
      const matches = textLower.match(re);
      if (matches) hits.push(...matches.map(() => m));
    });
    return hits;
  }

  function computeExclamationDensity(text) {
    const sentenceCount = Math.max(1, (text.match(/[.!?]+/g) || []).length);
    const exclCount = (text.match(/!/g) || []).length;
    return +(exclCount / sentenceCount).toFixed(3);
  }

  function computeConclusionOriented(text) {
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    if (!sentences.length) return false;
    const avgLen = sentences.reduce((a, s) => a + s.split(/\s+/).length, 0) / sentences.length;
    const shortDeclarative = sentences.filter(s => s.split(/\s+/).length <= 8 && !/[,;:]/.test(s)).length;
    return (shortDeclarative / sentences.length) >= 0.5 && avgLen <= 10;
  }

  function scoreHyperbole(text) {
    if (!text || typeof text !== 'string' || !text.trim()) {
      return { score: 0, markers: [], markerCount: 0, exclamationDensity: 0, conclusionOriented: false };
    }
    const textLower = text.toLowerCase();
    const hits = countMarkerHits(textLower, SUPERLATIVE_MARKERS);
    const wordCount = Math.max(1, text.trim().split(/\s+/).length);
    const markerDensity = Math.min(1, hits.length / Math.max(4, wordCount / 6));
    const exclamationDensity = computeExclamationDensity(text);
    const conclusionOriented = computeConclusionOriented(text);
    const score = Math.max(0, Math.min(1, markerDensity * 0.55 + Math.min(1, exclamationDensity) * 0.25 + (conclusionOriented ? 0.2 : 0)));
    return {
      score: +score.toFixed(3),
      markers: [...new Set(hits)],
      markerCount: hits.length,
      exclamationDensity,
      conclusionOriented
    };
  }

  return {
    SUPERLATIVE_MARKERS,
    ABSOLUTIST_MARKERS,
    scoreHyperbole
  };
})();