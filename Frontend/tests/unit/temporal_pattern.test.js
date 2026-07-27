const { loadFrontendModules } = require('../support/load_frontend.js');

function entriesFromScores(scores) {
  const mostRecentFirst = [...scores].reverse();
  return mostRecentFirst.map((s) => ({ sentiment_score: s }));
}

describe('temporal trend classification', () => {
  let baseline;

  beforeEach(() => {
    ({ baseline } = loadFrontendModules());
  });

  it('returns insufficient data with fewer than 3 entries', () => {
    const result = baseline.classifyTemporalTrendFallback([{ sentiment_score: 50 }, { sentiment_score: 60 }]);
    expect(result.label).toBe('insufficient data');
    expect(result.direction).toBe('neutral');
  });

  it('classifies a steadily declining sequence as declining', () => {
    const scores = [70, 65, 60, 55, 50, 45, 40, 35, 30, 25];
    const result = baseline.classifyTemporalTrendFallback(entriesFromScores(scores));
    expect(result.label).toBe('declining');
    expect(result.direction).toBe('down');
    expect(result.slope).toBeLessThanOrEqual(-1);
  });

  it('classifies a steadily improving sequence as improving', () => {
    const scores = [20, 25, 30, 35, 40, 45, 50, 55, 60, 65];
    const result = baseline.classifyTemporalTrendFallback(entriesFromScores(scores));
    expect(result.label).toBe('improving');
    expect(result.direction).toBe('up');
    expect(result.slope).toBeGreaterThanOrEqual(1);
  });

  it('classifies a flat sequence as stable', () => {
    const scores = [50, 52, 49, 51, 50, 48, 51, 50, 49, 50];
    const result = baseline.classifyTemporalTrendFallback(entriesFromScores(scores));
    expect(result.label).toBe('stable');
    expect(result.direction).toBe('neutral');
  });

  it('classifies a high-variance oscillating sequence with near-zero net slope as cyclical', () => {
    const scores = [30, 80, 20, 80, 20, 80, 20, 80, 20, 70];
    const result = baseline.classifyTemporalTrendFallback(entriesFromScores(scores));
    expect(result.label).toBe('cyclical');
    expect(result.direction).toBe('mixed');
  });

  it('classifies an older decline followed by a recent flat period as stabilizing', () => {
    const scores = [80, 70, 60, 50, 40, 38, 37, 36, 37, 36];
    const result = baseline.classifyTemporalTrendFallback(entriesFromScores(scores));
    expect(result.label).toBe('stabilizing');
    expect(result.direction).toBe('mixed');
  });

  it('respects consent scopes: temporal analysis disabled returns a disabled result', async () => {
    const result = await baseline.classifyTemporalTrend(
      entriesFromScores([70, 65, 60, 55, 50, 45, 40, 35, 30, 25]),
      { consent: { temporal: false } }
    );
    expect(result.disabled).toBe(true);
    expect(result.label).toBe('disabled');
  });
});