const { loadFrontendModules } = require('../support/load_frontend.js');

describe('utility_decomposition', () => {
  let utility;

  beforeEach(() => {
    ({ utility } = loadFrontendModules());
  });

  it('exposes the five canonical actions', () => {
    expect(utility.ACTIONS).toEqual(['affirm', 'encourage', 'reflect', 'support', 'intervene']);
  });

  it('computes decomposed utility with the documented breakdown shape', () => {
    const l1 = { sentiment: 'Negative', positiveWordCount: 1, negativeWordCount: 4 };
    const l2 = { dominant: 'expression', distribution: {} };
    const l3 = { direction: 'neutral', label: 'stable', slope: 0 };
    const l4 = { score: 80, label: 'Strongly aligned' };
    const weights = { w_task: 0.4, w_safety: 0.35, lambda_privacy: 0.15, lambda_autonomy: 0.10 };
    const z = { l1, l2, l3, l4, entryHistory: [], inferenceDepth: 0, autonomyPreference: 0.5 };

    const result = utility.computeDecomposedUtility('reflect', z, weights);
    expect(result.utility).toBeCloseTo(0.367, 3);
    expect(result.breakdown.appropriateness).toBeCloseTo(0.86, 3);
    expect(result.breakdown.safety).toBeCloseTo(0.2, 3);
    expect(result.breakdown.privacyCost).toBeCloseTo(0.25, 3);
    expect(result.breakdown.autonomyCost).toBeCloseTo(0.1, 3);
  });

  it('Section 7.2 toy example: aligned goal, stable trend, mild negative sentiment picks validation over intervention', () => {
    const l1 = { sentiment: 'Negative', positiveWordCount: 1, negativeWordCount: 4 };
    const l2 = { dominant: 'expression', distribution: {} };
    const l3 = { direction: 'neutral', label: 'stable', slope: 0 };
    const l4 = { score: 80, label: 'Strongly aligned' };
    const weights = { w_task: 0.4, w_safety: 0.35, lambda_privacy: 0.15, lambda_autonomy: 0.10 };
    const z = { l1, l2, l3, l4, entryHistory: [], inferenceDepth: 0, autonomyPreference: 0.5 };

    const scored = utility.ACTIONS.map((action) => utility.computeDecomposedUtility(action, z, weights));
    const best = scored.reduce((a, b) => (b.utility > a.utility ? b : a));
    const bestAction = utility.ACTIONS[scored.indexOf(best)];

    expect(bestAction).not.toBe('intervene');
    expect(best.utility).toBeGreaterThan(scored[utility.ACTIONS.indexOf('intervene')].utility);
  });

  it('rewards gentle actions with higher safety when recent entries are concerning', () => {
    const l1 = { sentiment: 'Negative', positiveWordCount: 0, negativeWordCount: 6 };
    const l3 = { direction: 'down', label: 'declining', slope: -3 };
    const entryHistory = [{ sentiment_score: 20 }, { sentiment_score: 18 }, { sentiment_score: 22 }];

    const safetyIntervene = utility.computeSafety('intervene', l1, l3, entryHistory);
    const safetyAffirm = utility.computeSafety('affirm', l1, l3, entryHistory);

    expect(safetyIntervene).toBe(1);
    expect(safetyAffirm).toBe(-1);
  });

  it('privacy cost scales with action depth and inference depth', () => {
    expect(utility.computePrivacyCost('affirm', 0)).toBe(0);
    expect(utility.computePrivacyCost('intervene', 0)).toBeCloseTo(0.75, 3);
    expect(utility.computePrivacyCost('intervene', 1)).toBe(1);
  });

  it('autonomy cost scales with user autonomy preference', () => {
    expect(utility.computeAutonomyCost('intervene', 0)).toBe(0);
    expect(utility.computeAutonomyCost('intervene', 1)).toBe(1);
    expect(utility.computeAutonomyCost('affirm', 1)).toBe(0);
  });

  it('clamps raw utility into the [-1, 1] range', () => {
    const l1 = { sentiment: 'Positive', positiveWordCount: 10, negativeWordCount: 0 };
    const l2 = { dominant: 'assertion', distribution: {} };
    const l3 = { direction: 'up', label: 'improving', slope: 5 };
    const l4 = { score: 100, label: 'Strongly aligned' };
    const weights = { w_task: 1, w_safety: 1, lambda_privacy: 0, lambda_autonomy: 0 };
    const z = { l1, l2, l3, l4, entryHistory: [], inferenceDepth: 0, autonomyPreference: 0 };

    const result = utility.computeDecomposedUtility('affirm', z, weights);
    expect(result.utility).toBeLessThanOrEqual(1);
    expect(result.utility).toBeGreaterThanOrEqual(-1);
  });
});