const { loadFrontendModules } = require('../support/load_frontend.js');

describe('hyperbole_lexicon + context collapse guard', () => {
  let hyperbole;
  let baseline;

  beforeEach(() => {
    ({ hyperbole, baseline } = loadFrontendModules());
  });

  it('returns a zero score for empty or non-string input', () => {
    expect(hyperbole.scoreHyperbole('')).toEqual({
      score: 0, markers: [], markerCount: 0, exclamationDensity: 0, conclusionOriented: false,
    });
    expect(hyperbole.scoreHyperbole(undefined)).toEqual({
      score: 0, markers: [], markerCount: 0, exclamationDensity: 0, conclusionOriented: false,
    });
  });

  it('Section 5.1: hyperbole after a minor inconvenience scores high and downgrades intervene', () => {
    const text = 'This is literally the worst day ever! Everything is ruined! Nothing ever goes right!';
    const hyperboleScore = hyperbole.scoreHyperbole(text);
    expect(hyperboleScore.score).toBeGreaterThanOrEqual(0.55);
    expect(hyperboleScore.markers).toEqual(expect.arrayContaining(['worst', 'everything', 'nothing']));

    const l1 = { sentiment: 'Negative', sentimentConfidence: 0.8, positiveWordCount: 0, negativeWordCount: 5 };
    const l3Stable = { direction: 'neutral', label: 'stable', slope: 0 };
    const guard = baseline.contextCollapseGuard(l1, l3Stable, hyperboleScore);

    expect(guard.collapseDetected).toBe(true);
    expect(guard.downgradeTo).toBe('support');
  });

  it('does not downgrade when the trend is genuinely declining', () => {
    const text = 'This is literally the worst day ever! Everything is ruined! Nothing ever goes right!';
    const hyperboleScore = hyperbole.scoreHyperbole(text);
    const l1 = { sentiment: 'Negative', sentimentConfidence: 0.8, positiveWordCount: 0, negativeWordCount: 5 };
    const l3Declining = { direction: 'down', label: 'declining', slope: -3 };

    const guard = baseline.contextCollapseGuard(l1, l3Declining, hyperboleScore);

    expect(guard.collapseDetected).toBe(false);
    expect(guard.downgradeTo).toBeNull();
  });

  it('does not flag hyperbole below the threshold', () => {
    const text = 'I have been feeling really hopeless lately and I do not know how much more I can take.';
    const hyperboleScore = hyperbole.scoreHyperbole(text);
    expect(hyperboleScore.score).toBeLessThan(0.55);

    const l1 = { sentiment: 'Negative', sentimentConfidence: 0.8, positiveWordCount: 0, negativeWordCount: 3 };
    const l3Stable = { direction: 'neutral', label: 'stable', slope: 0 };
    const guard = baseline.contextCollapseGuard(l1, l3Stable, hyperboleScore);

    expect(guard.collapseDetected).toBe(false);
  });

  it('applyEthicalFilter downgrades intervene to support when the guard fires, but not when the trend is declining', () => {
    const text = 'This is literally the worst day ever! Everything is ruined! Nothing ever goes right!';
    const l1 = { sentiment: 'Negative', sentimentConfidence: 0.8, positiveWordCount: 0, negativeWordCount: 5 };
    const entries = [1, 2, 3];

    const stableResult = baseline.applyEthicalFilter('intervene', entries, l1, {
      l3: { direction: 'neutral', label: 'stable', slope: 0 },
      rawText: text,
      typedGoals: [],
      returnDetails: true,
    });
    expect(stableResult.action).toBe('support');
    expect(stableResult.contextCollapseGuard.collapseDetected).toBe(true);

    const decliningResult = baseline.applyEthicalFilter('intervene', entries, l1, {
      l3: { direction: 'down', label: 'declining', slope: -3 },
      rawText: text,
      typedGoals: [],
      returnDetails: true,
    });
    expect(decliningResult.action).toBe('intervene');
  });

  it('never downgrades when the active goal is trauma-processing, even with high hyperbole', () => {
    const text = 'This is literally the worst day ever! Everything is ruined! Nothing ever goes right!';
    const l1 = { sentiment: 'Negative', sentimentConfidence: 0.8, positiveWordCount: 0, negativeWordCount: 5 };
    const entries = [1, 2, 3];
    const typedGoals = [{ status: 'active', text: 'process my grief around the past year' }];

    const result = baseline.applyEthicalFilter('intervene', entries, l1, {
      l3: { direction: 'neutral', label: 'stable', slope: 0 },
      rawText: text,
      typedGoals,
      returnDetails: true,
    });

    expect(result.action).toBe('intervene');
  });
});