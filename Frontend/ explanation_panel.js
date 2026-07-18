window.MindNookExplanation = (function () {
  function safeNum(v) {
    return v == null ? '—' : v;
  }

  function buildBreakdownRows(l1, l2, l3, l4, l5) {
    const rows = [];
    rows.push(['Sentiment', (l1 && l1.sentiment) || '—']);
    rows.push(['Pragmatic category', (l2 && l2.dominant) || '—']);
    rows.push(['Temporal trend', (l3 && l3.label) || '—']);
    rows.push(['Goal alignment', (l4 && l4.label) || '—']);
    rows.push(['Selected action', (l5 && l5.action) || '—']);
    if (l5 && l5.breakdown) {
      rows.push(['Appropriateness', safeNum(l5.breakdown.appropriateness)]);
      rows.push(['Safety', safeNum(l5.breakdown.safety)]);
      rows.push(['Privacy cost', safeNum(l5.breakdown.privacyCost)]);
      rows.push(['Autonomy cost', safeNum(l5.breakdown.autonomyCost)]);
    }
    return rows;
  }

  function renderExplanationPanel(containerEl, layers, ctx) {
    if (!containerEl) return;
    const { l1, l2, l3, l4, l5 } = layers || {};
    const explanation = (window.MindNookBaseline && window.MindNookBaseline.buildExplanation)
      ? window.MindNookBaseline.buildExplanation(l1, l2, l3, l4, l5)
      : 'Not enough analysis data for this entry yet.';
    const rows = buildBreakdownRows(l1, l2, l3, l4, l5);
    const panelId = 'mn-explain-' + Math.random().toString(36).slice(2, 9);

    const wrap = document.createElement('div');
    wrap.className = 'mn-explain-panel';
    wrap.innerHTML = `
      <button type="button" class="mn-explain-toggle" data-target="${panelId}">Why am I seeing this? <span class="mn-explain-chevron">▾</span></button>
      <div class="mn-explain-body" id="${panelId}" hidden>
        <p class="mn-explain-text">${explanation}</p>
        <table class="mn-explain-table">
          <tbody>
            ${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}
          </tbody>
        </table>
        <button type="button" class="mn-explain-flag">This doesn't seem right</button>
        <form class="mn-explain-form" hidden>
          <label>Which part seems off?</label>
          <select class="mn-explain-layer-select">
            <option value="sentiment">Sentiment</option>
            <option value="pragmatic">Communication style</option>
            <option value="trend">Trend</option>
            <option value="goal">Goal alignment</option>
            <option value="action">Chosen response</option>
          </select>
          <textarea class="mn-explain-comment" placeholder="Optional details" rows="2"></textarea>
          <div class="mn-explain-form-actions">
            <button type="submit" class="mn-explain-submit">Send feedback</button>
            <span class="mn-explain-status"></span>
          </div>
        </form>
      </div>`;
    containerEl.appendChild(wrap);

    const toggleBtn = wrap.querySelector('.mn-explain-toggle');
    const body = wrap.querySelector('.mn-explain-body');
    toggleBtn.addEventListener('click', () => {
      const isHidden = body.hasAttribute('hidden');
      if (isHidden) { body.removeAttribute('hidden'); toggleBtn.classList.add('open'); }
      else { body.setAttribute('hidden', ''); toggleBtn.classList.remove('open'); }
    });

    const flagBtn = wrap.querySelector('.mn-explain-flag');
    const form = wrap.querySelector('.mn-explain-form');
    flagBtn.addEventListener('click', () => {
      form.hidden = !form.hidden;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const statusEl = wrap.querySelector('.mn-explain-status');
      const layerSelect = wrap.querySelector('.mn-explain-layer-select');
      const commentEl = wrap.querySelector('.mn-explain-comment');
      const submitBtn = wrap.querySelector('.mn-explain-submit');
      submitBtn.disabled = true;
      statusEl.textContent = 'Sending...';
      try {
        if (!ctx || !ctx.supabaseClient) throw new Error('no_client');
        await ctx.supabaseClient.from('explanation_feedback').insert([{
          user_id: ctx.userId || null,
          entry_id: ctx.entryId || null,
          disagreed_layer: layerSelect.value,
          comment: (commentEl.value || '').slice(0, 500),
        }]);
        statusEl.textContent = 'Thanks — feedback received.';
        commentEl.value = '';
      } catch (err) {
        statusEl.textContent = 'Could not send feedback.';
      } finally {
        submitBtn.disabled = false;
      }
    });
  }

  return { renderExplanationPanel };
})();