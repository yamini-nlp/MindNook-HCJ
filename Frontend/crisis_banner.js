window.MindNookCrisisBanner = (function () {
  let resourceCache = null;

  async function loadResource(countryCode) {
    if (!resourceCache) {
      try {
        const res = await fetch('crisis_resources.json');
        resourceCache = await res.json();
      } catch (e) {
        resourceCache = { international: { name: 'International Association for Suicide Prevention', number: '', url: 'https://www.iasp.info/resources/Crisis_Centres/' } };
      }
    }
    return (countryCode && resourceCache[countryCode]) || resourceCache.international;
  }

  function renderAcuteBanner(resource, onAcknowledge) {
    if (document.getElementById('mindnookAcuteBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'mindnookAcuteBanner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'true');
    banner.setAttribute('aria-live', 'assertive');
    banner.setAttribute('aria-labelledby', 'mindnookAcuteBannerTitle');
    banner.setAttribute('aria-describedby', 'mindnookAcuteBannerDesc');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#3a1418;color:#f5e6e8;padding:18px 24px;font-family:"DM Sans",sans-serif;box-shadow:0 4px 24px rgba(0,0,0,0.4);';
    const linkHtml = resource.url ? ` · <a href="${resource.url}" target="_blank" rel="noopener" style="color:#f5c6cc;text-decoration:underline;">${resource.url}</a>` : '';
    const numberHtml = resource.number ? `${resource.number}${linkHtml ? ' · ' : ''}` : '';
    banner.innerHTML = `
      <div style="max-width:760px;margin:0 auto;">
        <div id="mindnookAcuteBannerTitle" style="font-size:0.95rem;font-weight:500;margin-bottom:8px;">If you are in crisis or thinking about suicide, please reach out for support.</div>
        <div id="mindnookAcuteBannerDesc" style="font-size:0.85rem;line-height:1.7;margin-bottom:14px;">${resource.name}: ${numberHtml}${resource.url && !numberHtml ? `<a href="${resource.url}" target="_blank" rel="noopener" style="color:#f5c6cc;text-decoration:underline;">${resource.url}</a>` : ''}</div>
        <button id="mindnookAcuteAck" style="padding:9px 20px;border-radius:30px;border:2px solid transparent;background:#f5e6e8;color:#3a1418;font-weight:500;cursor:pointer;">I understand</button>
      </div>`;
    document.body.appendChild(banner);

    const ackBtn = document.getElementById('mindnookAcuteAck');
    ackBtn.style.outlineOffset = '2px';
    ackBtn.addEventListener('focus', () => { ackBtn.style.outline = '3px solid #f5c6cc'; });
    ackBtn.addEventListener('blur', () => { ackBtn.style.outline = 'none'; });

    let releaseFocus = null;
    if (window.MindNookA11y) {
      releaseFocus = window.MindNookA11y.trapFocus(banner, { allowEscape: false });
      window.MindNookA11y.announce('Crisis support information is available. ' + resource.name, 'assertive');
    } else {
      ackBtn.focus();
    }

    ackBtn.onclick = () => {
      if (typeof releaseFocus === 'function') releaseFocus();
      banner.remove();
      if (typeof onAcknowledge === 'function') onAcknowledge();
    };
  }

  function renderPatternCard(containerId, onDismiss) {
    const container = document.getElementById(containerId);
    if (!container || document.getElementById('mindnookPatternCard')) return;
    const card = document.createElement('div');
    card.id = 'mindnookPatternCard';
    card.setAttribute('role', 'note');
    card.setAttribute('aria-live', 'polite');
    card.style.cssText = 'margin-top:14px;padding:16px 18px;background:rgba(217,197,178,0.06);border:1px solid rgba(217,197,178,0.18);border-radius:14px;font-family:"DM Sans",sans-serif;';
    card.innerHTML = `
      <div style="font-size:0.78rem;font-weight:500;margin-bottom:6px;color:var(--text,#f0ece2);">A gentle note</div>
      <div style="font-size:0.78rem;line-height:1.7;color:var(--text2,rgba(240,236,226,0.65));margin-bottom:10px;">Your entries have shown some difficulty for a while now. It might help to talk this through with someone you trust, or a professional.</div>
      <button id="mindnookPatternDismiss" aria-label="Dismiss this note" style="padding:6px 16px;border-radius:30px;border:1px solid rgba(217,197,178,0.3);background:transparent;color:var(--text2,rgba(240,236,226,0.65));font-size:0.7rem;cursor:pointer;">Dismiss</button>`;
    container.appendChild(card);
    const dismissBtn = document.getElementById('mindnookPatternDismiss');
    dismissBtn.style.outlineOffset = '2px';
    const activate = () => {
      card.remove();
      if (typeof onDismiss === 'function') onDismiss();
    };
    if (window.MindNookA11y) {
      window.MindNookA11y.bindActivation(dismissBtn, activate);
    } else {
      dismissBtn.onclick = activate;
    }
  }

  return { loadResource, renderAcuteBanner, renderPatternCard };
})();