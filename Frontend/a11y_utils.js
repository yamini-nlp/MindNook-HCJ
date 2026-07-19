window.MindNookA11y = (function () {
  const KEYBOARD_KEYS = {
    TAB: 'Tab',
    ENTER: 'Enter',
    SPACE: ' ',
    ESCAPE: 'Escape',
    ARROW_LEFT: 'ArrowLeft',
    ARROW_RIGHT: 'ArrowRight',
  };

  const FOCUSABLE_SELECTOR = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

  let liveRegionPolite = null;
  let liveRegionAssertive = null;
  let lastAnnouncedPolite = '';
  let lastAnnouncedAssertive = '';

  function ensureLiveRegions() {
    if (!liveRegionPolite) {
      liveRegionPolite = document.createElement('div');
      liveRegionPolite.setAttribute('aria-live', 'polite');
      liveRegionPolite.setAttribute('role', 'status');
      liveRegionPolite.className = 'mn-sr-only';
      liveRegionPolite.id = 'mn-a11y-live-polite';
      document.body.appendChild(liveRegionPolite);
    }
    if (!liveRegionAssertive) {
      liveRegionAssertive = document.createElement('div');
      liveRegionAssertive.setAttribute('aria-live', 'assertive');
      liveRegionAssertive.setAttribute('role', 'alert');
      liveRegionAssertive.className = 'mn-sr-only';
      liveRegionAssertive.id = 'mn-a11y-live-assertive';
      document.body.appendChild(liveRegionAssertive);
    }
  }

  function announce(text, politeness) {
    if (!text) return;
    ensureLiveRegions();
    const isAssertive = politeness === 'assertive';
    const region = isAssertive ? liveRegionAssertive : liveRegionPolite;
    const lastText = isAssertive ? lastAnnouncedAssertive : lastAnnouncedPolite;
    if (lastText === text) return;
    if (isAssertive) lastAnnouncedAssertive = text; else lastAnnouncedPolite = text;
    region.textContent = '';
    window.setTimeout(() => { region.textContent = text; }, 30);
  }

  function getFocusable(containerEl) {
    if (!containerEl) return [];
    return Array.from(containerEl.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  function trapFocus(containerEl, options) {
    if (!containerEl) return function () {};
    const opts = options || {};
    const previouslyFocused = document.activeElement;
    const allowEscape = opts.allowEscape !== false;
    const onEscape = opts.onEscape;

    function handleKeydown(e) {
      if (e.key === KEYBOARD_KEYS.TAB) {
        const focusable = getFocusable(containerEl);
        if (!focusable.length) { e.preventDefault(); return; }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      } else if (e.key === KEYBOARD_KEYS.ESCAPE && allowEscape) {
        if (typeof onEscape === 'function') {
          e.preventDefault();
          onEscape();
        }
      }
    }

    containerEl.addEventListener('keydown', handleKeydown);
    const focusable = getFocusable(containerEl);
    if (focusable.length) {
      focusable[0].focus();
    } else {
      containerEl.setAttribute('tabindex', '-1');
      containerEl.focus();
    }

    return function releaseFocus() {
      containerEl.removeEventListener('keydown', handleKeydown);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.body.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }

  function bindActivation(el, handler) {
    if (!el) return;
    el.addEventListener('click', handler);
    el.addEventListener('keydown', (e) => {
      if (e.key === KEYBOARD_KEYS.ENTER || e.key === KEYBOARD_KEYS.SPACE) {
        e.preventDefault();
        handler(e);
      }
    });
  }

  function injectSrOnlyStyle() {
    if (document.getElementById('mn-sr-only-style')) return;
    const style = document.createElement('style');
    style.id = 'mn-sr-only-style';
    style.textContent = '.mn-sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}';
    document.head.appendChild(style);
  }

  injectSrOnlyStyle();

  return {
    KEYBOARD_KEYS,
    FOCUSABLE_SELECTOR,
    trapFocus,
    announce,
    getFocusable,
    bindActivation,
  };
})();
if (typeof module !== 'undefined' && module.exports) { module.exports = window.MindNookA11y; }