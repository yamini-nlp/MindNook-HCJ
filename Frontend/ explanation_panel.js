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
    wrap.setAttribute('aria-live', 'polite');
    wrap.innerHTML = `
      <button type="button" class="mn-explain-toggle" data-target="${panelId}" aria-expanded="false" aria-controls="${panelId}">Why am I seeing this? <span class="mn-explain-chevron" aria-hidden="true">▾</span></button>
      <div class="mn-explain-body" id="${panelId}" hidden role="region" aria-label="Explanation details">
        <p class="mn-explain-text">${explanation}</p>
        <table class="mn-explain-table">
          <caption class="mn-sr-only">Analysis breakdown for this entry</caption>
          <thead class="mn-sr-only"><tr><th scope="col">Factor</th><th scope="col">Value</th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr><th scope="row">${r[0]}</th><td>${r[1]}</td></tr>`).join('')}
          </tbody>
        </table>
        <button type="button" class="mn-explain-flag" aria-expanded="false" aria-controls="${panelId}-form">This doesn't seem right</button>
        <form class="mn-explain-form" id="${panelId}-form" hidden aria-label="Report an inaccurate analysis">
          <label for="${panelId}-select">Which part seems off?</label>
          <select class="mn-explain-layer-select" id="${panelId}-select">
            <option value="sentiment">Sentiment</option>
            <option value="pragmatic">Communication style</option>
            <option value="trend">Trend</option>
            <option value="goal">Goal alignment</option>
            <option value="action">Chosen response</option>
          </select>
          <label for="${panelId}-comment">Optional details</label>
          <textarea class="mn-explain-comment" id="${panelId}-comment" placeholder="Optional details" rows="2"></textarea>
          <div class="mn-explain-form-actions">
            <button type="submit" class="mn-explain-submit">Send feedback</button>
            <span class="mn-explain-status" role="status" aria-live="polite"></span>
          </div>
        </form>
      </div>`;
    containerEl.appendChild(wrap);

    const toggleBtn = wrap.querySelector('.mn-explain-toggle');
    const body = wrap.querySelector('.mn-explain-body');
    const toggleOpen = () => {
      const isHidden = body.hasAttribute('hidden');
      if (isHidden) {
        body.removeAttribute('hidden');
        toggleBtn.classList.add('open');
        toggleBtn.setAttribute('aria-expanded', 'true');
        if (window.MindNookA11y) window.MindNookA11y.announce('Explanation expanded.', 'polite');
      } else {
        body.setAttribute('hidden', '');
        toggleBtn.classList.remove('open');
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    };
    if (window.MindNookA11y) {
      window.MindNookA11y.bindActivation(toggleBtn, toggleOpen);
    } else {
      toggleBtn.addEventListener('click', toggleOpen);
    }

    const flagBtn = wrap.querySelector('.mn-explain-flag');
    const form = wrap.querySelector('.mn-explain-form');
    const toggleFlag = () => {
      form.hidden = !form.hidden;
      flagBtn.setAttribute('aria-expanded', form.hidden ? 'false' : 'true');
      if (!form.hidden) {
        const select = form.querySelector('select');
        if (select) select.focus();
      }
    };
    if (window.MindNookA11y) {
      window.MindNookA11y.bindActivation(flagBtn, toggleFlag);
    } else {
      flagBtn.addEventListener('click', toggleFlag);
    }

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