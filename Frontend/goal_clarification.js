window.MindNookGoalClarification = (function () {
  let activePromptGoalId = null;
  const queue = [];
  let styleInjected = false;

  function injectStyles() {
    if (styleInjected) return;
    styleInjected = true;
    const style = document.createElement('style');
    style.textContent = `
.mn-clarify-overlay{position:fixed;inset:0;background:rgba(13,26,24,0.72);backdrop-filter:blur(6px);z-index:900;display:flex;align-items:center;justify-content:center;padding:24px;opacity:0;transition:opacity 0.25s;}
.mn-clarify-overlay.mn-clarify-visible{opacity:1;}
.mn-clarify-card{background:var(--card,#1f3430);border:1px solid var(--border2,rgba(217,197,178,0.22));border-radius:18px;padding:28px 30px;max-width:420px;width:100%;box-shadow:0 24px 64px rgba(0,0,0,0.35);transform:translateY(8px);transition:transform 0.25s;font-family:'DM Sans',sans-serif;}
.mn-clarify-overlay.mn-clarify-visible .mn-clarify-card{transform:translateY(0);}
.mn-clarify-eyebrow{font-size:0.68rem;letter-spacing:2.5px;text-transform:uppercase;color:var(--teal,#5bc4a8);opacity:0.85;margin-bottom:10px;font-weight:500;}
.mn-clarify-question{font-family:'Playfair Display',serif;color:var(--text,#f0ece2);font-size:1.15rem;line-height:1.5;margin-bottom:20px;}
.mn-clarify-goal-text{color:var(--gold2,#c9a882);font-style:italic;}
.mn-clarify-actions{display:flex;flex-direction:column;gap:10px;}
.mn-clarify-btn{width:100%;padding:11px 16px;border-radius:50px;font-size:0.85rem;font-weight:500;cursor:pointer;transition:all 0.2s;font-family:'DM Sans',sans-serif;border:1px solid var(--border2,rgba(217,197,178,0.22));background:transparent;color:var(--text,#f0ece2);}
.mn-clarify-btn:hover{border-color:var(--gold,#d9c5b2);}
.mn-clarify-btn.mn-clarify-yes{background:var(--gold,#d9c5b2);color:var(--bg3,#0d1a18);border-color:var(--gold,#d9c5b2);font-weight:600;}
.mn-clarify-btn.mn-clarify-yes:hover{background:var(--gold3,#e8d8c8);}
.mn-clarify-btn:disabled{opacity:0.5;cursor:not-allowed;}
.mn-clarify-custom-row{display:flex;gap:8px;margin-top:4px;}
.mn-clarify-custom-input{flex:1;background:var(--bg2,#152422);border:1px solid var(--border2,rgba(217,197,178,0.22));color:var(--text,#f0ece2);border-radius:10px;padding:9px 12px;font-family:'DM Sans',sans-serif;font-size:0.82rem;}
.mn-clarify-status{font-size:0.75rem;color:var(--text3,rgba(240,236,226,0.38));margin-top:10px;min-height:16px;}
`;
    document.head.appendChild(style);
  }

  function closeOverlay(overlay) {
    overlay.classList.remove('mn-clarify-visible');
    setTimeout(() => { overlay.remove(); }, 250);
  }

  async function postAnswer(ctx, goalId, answer, customText) {
    const res = await fetch(`${ctx.supabaseUrl}/functions/v1/pragmatic-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctx.accessToken}` },
      body: JSON.stringify({ type: 'goal_clarification_response', goal_id: goalId, answer, custom_text: customText || undefined }),
    });
    if (!res.ok) throw new Error('clarification_response_failed');
    return await res.json();
  }

  function showNext() {
    if (activePromptGoalId || !queue.length) return;
    const job = queue.shift();
    activePromptGoalId = job.lowConfidenceGoal.id;
    buildAndShow(job.lowConfidenceGoal, job.ctx, job.resolve);
  }

  function buildAndShow(lowConfidenceGoal, ctx, resolve) {
    injectStyles();
    const overlay = document.createElement('div');
    overlay.className = 'mn-clarify-overlay';
    overlay.innerHTML = `
      <div class="mn-clarify-card">
        <div class="mn-clarify-eyebrow">Quick check-in</div>
        <div class="mn-clarify-question">Are you currently focused on: <span class="mn-clarify-goal-text"></span>?</div>
        <div class="mn-clarify-actions">
          <button type="button" class="mn-clarify-btn mn-clarify-yes" data-answer="yes">Yes</button>
          <button type="button" class="mn-clarify-btn" data-answer="not_quite">Not quite</button>
          <button type="button" class="mn-clarify-btn" data-answer="custom">Let me set my own</button>
        </div>
        <div class="mn-clarify-custom-row" hidden>
          <input type="text" class="mn-clarify-custom-input" placeholder="What are you focused on?" maxlength="200">
          <button type="button" class="mn-clarify-btn mn-clarify-yes mn-clarify-custom-submit">Save</button>
        </div>
        <div class="mn-clarify-status"></div>
      </div>`;
    overlay.querySelector('.mn-clarify-goal-text').textContent = lowConfidenceGoal.text;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('mn-clarify-visible'));

    const statusEl = overlay.querySelector('.mn-clarify-status');
    const buttons = overlay.querySelectorAll('.mn-clarify-btn[data-answer]');
    const customRow = overlay.querySelector('.mn-clarify-custom-row');
    const customInput = overlay.querySelector('.mn-clarify-custom-input');
    const customSubmit = overlay.querySelector('.mn-clarify-custom-submit');

    function finish(outcome) {
      activePromptGoalId = null;
      closeOverlay(overlay);
      resolve(outcome);
      showNext();
    }

    buttons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const answer = btn.getAttribute('data-answer');
        if (answer === 'custom') {
          customRow.hidden = false;
          customInput.focus();
          return;
        }
        buttons.forEach(b => { b.disabled = true; });
        statusEl.textContent = 'Saving...';
        try {
          await postAnswer(ctx, lowConfidenceGoal.id, answer);
          statusEl.textContent = 'Thanks — noted.';
          setTimeout(() => finish({ answer, ok: true }), 500);
        } catch (e) {
          statusEl.textContent = 'Could not save — continuing anyway.';
          setTimeout(() => finish({ answer, ok: false }), 800);
        }
      });
    });

    customSubmit.addEventListener('click', async () => {
      const customText = customInput.value.trim();
      if (!customText) { customInput.focus(); return; }
      buttons.forEach(b => { b.disabled = true; });
      customSubmit.disabled = true;
      statusEl.textContent = 'Saving...';
      try {
        await postAnswer(ctx, lowConfidenceGoal.id, 'custom', customText);
        statusEl.textContent = 'Thanks — updated your goal.';
        setTimeout(() => finish({ answer: 'custom', customText, ok: true }), 500);
      } catch (e) {
        statusEl.textContent = 'Could not save — continuing anyway.';
        setTimeout(() => finish({ answer: 'custom', customText, ok: false }), 800);
      }
    });
  }

  function renderClarificationPrompt(lowConfidenceGoal, ctx) {
    return new Promise((resolve) => {
      if (!lowConfidenceGoal || !lowConfidenceGoal.id || !lowConfidenceGoal.text || !ctx || !ctx.supabaseUrl || !ctx.accessToken) {
        resolve({ answer: null, ok: false });
        return;
      }
      queue.push({ lowConfidenceGoal, ctx, resolve });
      showNext();
    });
  }

  return { renderClarificationPrompt };
})();