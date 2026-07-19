const { loadFrontendModules } = require('../support/load_frontend.js');

describe('pragmatic classification: catharsis vs distress (Section 6.2)', () => {
  let baseline;

  beforeEach(() => {
    ({ baseline } = loadFrontendModules());
  });

  it('classifies cathartic venting as expression, not help-seeking', () => {
    const text = 'I feel so overwhelmed and exhausted lately. I feel like I have been carrying too much.';
    const result = baseline.classifyPragmatic(text);
    expect(result.dominant).toBe('expression');
  });

  it('classifies an explicit distress call as help-seeking with the same negative sentiment', () => {
    const text = 'I need help right now. Please, I do not know what to do, can I talk to someone?';
    const result = baseline.classifyPragmatic(text);
    expect(result.dominant).toBe('help-seeking');
  });

  it('reports a disabled result when pragmatic consent is off', () => {
    const result = baseline.classifyPragmatic('I need help right now.', { pragmatic: false });
    expect(result.disabled).toBe(true);
    expect(result.dominant).toBe('neutral');
  });
});

describe('goal alignment scoring', () => {
  let baseline;

  beforeEach(() => {
    ({ baseline } = loadFrontendModules());
    localStorage.setItem('mindnook_goals', JSON.stringify(['manage stress and burnout']));
    localStorage.setItem('mindnook_emotions', JSON.stringify(['anxious']));
    localStorage.setItem('mindnook_stress', '3');
  });

  it('returns "No goals set" when no goals are configured', () => {
    const analysis = { sentiment: 'Positive', positiveWordCount: 6, lexicalDiversity: 0.4, wordCount: 120 };
    const result = baseline.computeGoalAlignment(analysis, [], [], null);
    expect(result.label).toBe('No goals set');
    expect(result.score).toBeNull();
  });

  it('scores an entry as strongly aligned with a stress-reduction goal', () => {
    const analysis = { sentiment: 'Positive', positiveWordCount: 6, lexicalDiversity: 0.4, wordCount: 120 };
    const result = baseline.computeGoalAlignment(analysis, [], null, null);
    expect(result.score).toBe(80);
    expect(result.label).toBe('Strongly aligned');
  });

  it('reports a disabled result when goal-inference consent is off', () => {
    const analysis = { sentiment: 'Positive', positiveWordCount: 6, lexicalDiversity: 0.4, wordCount: 120 };
    const result = baseline.computeGoalAlignment(analysis, [], null, { goal_inference: false });
    expect(result.disabled).toBe(true);
    expect(result.score).toBeNull();
  });
});

describe('goal clarification threshold (Section 6.3, tau* = 0.35)', () => {
  let baseline;

  beforeEach(() => {
    ({ baseline } = loadFrontendModules());
  });

  it('defaults tau_goal to 0.6 when nothing is stored', () => {
    expect(baseline.getTauGoal()).toBe(0.6);
  });

  it('reads a custom tau_goal of 0.35 from storage', () => {
    localStorage.setItem('mindnook_tau_goal', '0.35');
    expect(baseline.getTauGoal()).toBe(0.35);
  });

  it('surfaces a pending goal only when its confidence is below tau* = 0.35', () => {
    localStorage.setItem('mindnook_tau_goal', '0.35');
    localStorage.setItem('mindnook_goals', JSON.stringify(['travel more']));
    const typedGoals = [
      { id: 'g1', text: 'write more clearly', status: 'pending_confirmation', confidence: 0.2 },
      { id: 'g2', text: 'reduce anxiety', status: 'pending_confirmation', confidence: 0.5 },
      { id: 'g3', text: 'travel more', status: 'active', confidence: 0.9 },
    ];
    const analysis = { sentiment: 'Positive', positiveWordCount: 6, lexicalDiversity: 0.4, wordCount: 120 };
    const result = baseline.computeGoalAlignment(analysis, [], typedGoals, null);

    expect(result.lowConfidenceGoal).toEqual({ id: 'g1', text: 'write more clearly', confidence: 0.2 });
  });

  it('does not surface a pending goal at or above tau*', () => {
    localStorage.setItem('mindnook_tau_goal', '0.35');
    localStorage.setItem('mindnook_goals', JSON.stringify(['travel more']));
    const typedGoals = [
      { id: 'g2', text: 'reduce anxiety', status: 'pending_confirmation', confidence: 0.5 },
      { id: 'g3', text: 'travel more', status: 'active', confidence: 0.9 },
    ];
    const analysis = { sentiment: 'Positive', positiveWordCount: 6, lexicalDiversity: 0.4, wordCount: 120 };
    const result = baseline.computeGoalAlignment(analysis, [], typedGoals, null);

    expect(result.lowConfidenceGoal).toBeUndefined();
  });
});