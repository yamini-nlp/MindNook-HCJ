window.MindNookGuardrail = (function () {
  const FALLBACK_TEMPLATES = [
    "I want to make sure I'm responding thoughtfully here — could you tell me a bit more about what's on your mind?",
    "I'd rather sit with this a little longer before responding. What feels most important to you right now?",
    "Let's slow down for a moment — what would be most helpful to focus on together?",
  ];

  function pickFallback() {
    return FALLBACK_TEMPLATES[Math.floor(Math.random() * FALLBACK_TEMPLATES.length)];
  }

  async function moderateReply(ctx, replyText) {
    const res = await fetch(`${ctx.supabaseUrl}/functions/v1/analyze-journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ctx.accessToken}` },
      body: JSON.stringify({ text: replyText, mode: 'moderate', entry_id: ctx.entryId || null }),
    });
    if (!res.ok) throw new Error('moderation_fn_error');
    return await res.json();
  }

  async function checkAndRegenerate(replyText, contextPayload) {
    const { supabaseUrl, accessToken, entryId, regenerate } = contextPayload;
    const ctx = { supabaseUrl, accessToken, entryId };
    try {
      const moderation = await moderateReply(ctx, replyText);
      if (moderation.safe || moderation.classifierUnavailable) {
        return { finalReply: replyText, safe: true, usedFallback: false };
      }
      if (typeof regenerate === 'function') {
        try {
          const regenerated = await regenerate();
          const secondModeration = await moderateReply(ctx, regenerated);
          if (secondModeration.safe || secondModeration.classifierUnavailable) {
            return { finalReply: regenerated, safe: true, usedFallback: false };
          }
        } catch (regenErr) {
          console.warn('Guardrail regeneration failed:', regenErr.message);
        }
      }
      return { finalReply: pickFallback(), safe: true, usedFallback: true };
    } catch (e) {
      console.warn('Ethical guardrail check failed, allowing original reply:', e.message);
      return { finalReply: replyText, safe: true, usedFallback: false };
    }
  }

  return { checkAndRegenerate };
})();