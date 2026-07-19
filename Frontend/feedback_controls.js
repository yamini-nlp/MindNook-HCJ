window.MindNookFeedbackControls = (function () {
  function renderFeedbackControls(containerEl, ctx) {
    if (!containerEl) return null;
    const wrap = document.createElement('div');
    wrap.className = 'mn-feedback-controls';
    wrap.innerHTML = `
      <span class="mn-feedback-label" id="mnFeedbackLabel">Was this response helpful?</span>
      <button type="button" class="mn-feedback-btn mn-feedback-up" aria-label="Thumbs up, this felt right" aria-pressed="false" title="This felt right">👍</button>
      <button type="button" class="mn-feedback-btn mn-feedback-down" aria-label="Thumbs down, this didn't feel right" aria-pressed="false" title="This didn't feel right">👎</button>
      <span class="mn-feedback-status" role="status" aria-live="polite"></span>`;
    containerEl.appendChild(wrap);

    const upBtn = wrap.querySelector('.mn-feedback-up');
    const downBtn = wrap.querySelector('.mn-feedback-down');
    const statusEl = wrap.querySelector('.mn-feedback-status');

    async function submit(rating, btn) {
      if (wrap.dataset.submitted === '1') return;
      upBtn.disabled = true;
      downBtn.disabled = true;
      btn.classList.add('selected');
      btn.setAttribute('aria-pressed', 'true');
      statusEl.textContent = 'Sending…';
      try {
        if (!ctx || !ctx.supabaseClient) throw new Error('no_client');
        const { error } = await ctx.supabaseClient.from('action_feedback').insert([{
          user_id: ctx.userId || null,
          entry_id: ctx.entryId || null,
          action: ctx.action || null,
          rating,
        }]);
        if (error) throw error;
        wrap.dataset.submitted = '1';
        statusEl.textContent = 'Thanks — feedback received.';
      } catch (err) {
        statusEl.textContent = 'Could not send feedback.';
        upBtn.disabled = false;
        downBtn.disabled = false;
        btn.classList.remove('selected');
        btn.setAttribute('aria-pressed', 'false');
      }
    }

    if (window.MindNookA11y) {
      window.MindNookA11y.bindActivation(upBtn, () => submit('up', upBtn));
      window.MindNookA11y.bindActivation(downBtn, () => submit('down', downBtn));
    } else {
      upBtn.addEventListener('click', () => submit('up', upBtn));
      downBtn.addEventListener('click', () => submit('down', downBtn));
    }

    return wrap;
  }

  function renderAdjustmentNotice(containerEl, ctx) {
    if (!containerEl) return null;
    const wrap = document.createElement('div');
    wrap.className = 'mn-adjustment-notice';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    wrap.innerHTML = `
      <span class="mn-adjustment-text">Your AI sensitivity has adjusted based on your feedback.</span>
      <button type="button" class="mn-adjustment-revert">Revert to defaults</button>
      <button type="button" class="mn-adjustment-dismiss" aria-label="Dismiss this notice">✕</button>`;
    containerEl.prepend(wrap);

    const dismissBtn = wrap.querySelector('.mn-adjustment-dismiss');
    const revertBtn = wrap.querySelector('.mn-adjustment-revert');
    const dismissActivate = () => wrap.remove();
    if (window.MindNookA11y) {
      window.MindNookA11y.bindActivation(dismissBtn, dismissActivate);
    } else {
      dismissBtn.addEventListener('click', dismissActivate);
    }

    revertBtn.addEventListener('click', async () => {
      revertBtn.disabled = true;
      revertBtn.textContent = 'Reverting…';
      try {
        if (ctx && typeof ctx.onRevert === 'function') {
          await ctx.onRevert();
        }
        wrap.querySelector('.mn-adjustment-text').textContent = 'Reverted to default sensitivity.';
        setTimeout(() => wrap.remove(), 2500);
      } catch (err) {
        revertBtn.disabled = false;
        revertBtn.textContent = 'Revert to defaults';
      }
    });

    return wrap;
  }

  return { renderFeedbackControls, renderAdjustmentNotice };
})();