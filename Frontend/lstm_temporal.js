window.MindNookLSTM = (function () {
  async function callTemporalLSTM(ctx, entries) {
    const res = await fetch(`${ctx.supabaseUrl}/functions/v1/temporal-lstm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctx.accessToken}` },
      body: JSON.stringify({
        mode: ctx.mode,
        sentiment_score: ctx.sentimentScore ?? null,
        entry_id: ctx.entryId ?? null,
      })
    });
    if (!res.ok) throw new Error('temporal_lstm_fn_error');
    const data = await res.json();
    const scores = (entries || []).slice(0, 20).reverse().map(e => window.MindNookBaseline.computeNumericSentimentScore(e));
    return {
      label: data.label,
      direction: data.direction,
      slope: 0,
      variance: 0,
      scores,
      attentionWeights: (data.attentionContributors || []).map(c => c.weight),
      attentionContributors: data.attentionContributors || [],
      probabilities: data.probabilities || {},
      hiddenState: data.hiddenState || [],
      shortMean: 0,
      longMean: 0,
      method: 'lstm'
    };
  }

  return { callTemporalLSTM };
})();