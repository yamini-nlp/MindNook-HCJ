const catharsisFixture = require('../fixtures/groq_responses/catharsis.json');
const distressFixture = require('../fixtures/groq_responses/distress_call.json');
const hyperboleFixture = require('../fixtures/groq_responses/hyperbole_minor_inconvenience.json');
const toyValidationFixture = require('../fixtures/groq_responses/toy_validation_example.json');

function makeGroqFetch(payload) {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }),
  }));
}

function makeSupabaseStub({ historyScores = [] } = {}) {
  const updateCalls = [];
  return {
    updateCalls,
    auth: {
      getUser: async () => ({ data: { user: { id: 'test-user' } }, error: null }),
    },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        in() { return this; },
        ilike() { return this; },
        gte() { return this; },
        limit: async () => ({ data: historyScores.map((s) => ({ sentiment_score: s })) }),
        update(payload) {
          updateCalls.push(payload);
          return this;
        },
        insert() { return this; },
        single: async () => ({ data: null }),
      };
    },
  };
}

function makeDeps({ groqPayload, historyScores }) {
  const supabase = makeSupabaseStub({ historyScores });
  return {
    deps: {
      env: { get: (key) => ({ GROQ_API_KEY: 'test-key', SUPABASE_URL: 'http://localhost', SUPABASE_ANON_KEY: 'anon' }[key]) },
      createSupabaseClient: () => supabase,
      groqFetch: makeGroqFetch(groqPayload),
    },
    supabase,
  };
}

function buildRequest(body) {
  return new Request('http://localhost/pragmatic-analysis', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('pragmatic-analysis edge function (mocked Supabase + Groq)', () => {
  let createHandler;

  beforeAll(async () => {
    const mod = await import('../../supabase/functions/pragmatic-analysis/handler.ts');
    createHandler = mod.createHandler;
  });

  it('Section 6.2: catharsis and an explicit distress call with the same negative sentiment pick different actions', async () => {
    const { deps: catharsisDeps } = makeDeps({ groqPayload: catharsisFixture, historyScores: [] });
    const catharsisRes = await createHandler(catharsisDeps)(buildRequest({
      type: 'combined',
      content: 'I feel so overwhelmed and exhausted lately.',
      sentiment: 'Negative',
      goals: [],
      entry_id: 'entry-catharsis',
      trend_label: 'stable',
      trend_direction: 'neutral',
      positive_word_count: 0,
      negative_word_count: 3,
    }));
    const catharsisBody = await catharsisRes.json();

    const { deps: distressDeps } = makeDeps({ groqPayload: distressFixture, historyScores: [20, 22, 18] });
    const distressRes = await createHandler(distressDeps)(buildRequest({
      type: 'combined',
      content: 'I need help right now, please.',
      sentiment: 'Negative',
      goals: [],
      entry_id: 'entry-distress',
      trend_label: 'declining',
      trend_direction: 'down',
      positive_word_count: 0,
      negative_word_count: 3,
    }));
    const distressBody = await distressRes.json();

    expect(catharsisBody.layer5_action.action).not.toBe(distressBody.layer5_action.action);
    expect(distressBody.layer5_action.action).toBe('support');
  });

  it('Section 5.1: hyperbole about a minor inconvenience downgrades an otherwise-selected intervene', async () => {
    const { deps } = makeDeps({ groqPayload: hyperboleFixture, historyScores: [] });
    const res = await createHandler(deps)(buildRequest({
      type: 'combined',
      content: 'This is literally the worst day ever! Everything is ruined! Nothing ever goes right!',
      sentiment: 'Negative',
      goals: [],
      entry_id: 'entry-hyperbole',
      trend_label: 'stable',
      trend_direction: 'down',
      positive_word_count: 0,
      negative_word_count: 5,
      autonomy_preference: 0.1,
    }));
    const body = await res.json();

    expect(body.layer5_action.contextCollapseGuard.collapseDetected).toBe(true);
    expect(body.layer5_action.action).toBe('support');
    expect(body.layer5_action.action).not.toBe('intervene');
  });

  it('Section 7.2 toy example: aligned goal and stable trend pick validation over intervention', async () => {
    const { deps } = makeDeps({ groqPayload: toyValidationFixture, historyScores: [] });
    const res = await createHandler(deps)(buildRequest({
      type: 'combined',
      content: 'Reflecting on how things have been going with my emotional awareness practice.',
      sentiment: 'Negative',
      goals: ['build emotional self-awareness'],
      entry_id: 'entry-toy',
      trend_label: 'stable',
      trend_direction: 'neutral',
      positive_word_count: 1,
      negative_word_count: 2,
    }));
    const body = await res.json();

    expect(body.layer5_action.action).not.toBe('intervene');
  });

  it('rejects requests without an Authorization header', async () => {
    const { deps } = makeDeps({ groqPayload: catharsisFixture });
    const req = new Request('http://localhost/pragmatic-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'combined', content: 'hello' }),
    });
    const res = await createHandler(deps)(req);
    expect(res.status).toBe(401);
  });

  it('returns a 500 with a server configuration error when GROQ_API_KEY is missing', async () => {
    const supabase = makeSupabaseStub({});
    const deps = {
      env: { get: () => undefined },
      createSupabaseClient: () => supabase,
      groqFetch: makeGroqFetch(catharsisFixture),
    };
    const res = await createHandler(deps)(buildRequest({ type: 'combined', content: 'hello' }));
    expect(res.status).toBe(500);
  });
});