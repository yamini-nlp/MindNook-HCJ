window.MindNookCalibrationWizard = (function () {
  const PRESETS = {
    minimal: { cfp: 0.6, cfn: 0.4 },
    balanced: { cfp: 0.4, cfn: 0.6 },
    proactive: { cfp: 0.25, cfn: 0.75 },
  };

  const DEFAULT_WEIGHTS = { w_task: 0.4, w_safety: 0.35, lambda_privacy: 0.15, lambda_autonomy: 0.10 };

  const SCENARIO = {
    l1: { sentiment: 'Negative', sentimentConfidence: 0.9, positiveWordCount: 0, negativeWordCount: 6 },
    l2: { dominant: 'expression', distribution: { assertion: 10, expression: 70, helpSeeking: 10, question: 10 } },
    l3: { direction: 'neutral', label: 'stable', slope: 0, variance: 40 },
    l4: { score: 82, label: 'Strongly aligned', goals: ['Understand my emotions'] },
    entryHistory: [],
  };

  const ACTION_META = {
    support: { label: 'Validation', desc: 'Offer steady, empathetic support without escalating.' },
    intervene: { label: 'Intervention', desc: 'Gently check in more directly on the pattern.' },
    reflect: { label: 'Reflective', desc: 'Reflect back what was shared, neutrally.' },
  };

  let styleInjected = false;

  function injectStyleFallback() {
    if (styleInjected || document.getElementById('calibration_wizard_css')) return;
    styleInjected = true;
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function debounce(fn, wait) {
    let t = null;
    return function debounced(...args) {
      window.clearTimeout(t);
      t = window.setTimeout(() => fn.apply(this, args), wait);
    };
  }

  function computeTau(cfp, cfn) {
    return clamp(cfp / (cfp + cfn), 0.05, 0.95);
  }

  function computeExample(cfp, cfn, weights) {
    const utilityModule = window.MindNookUtility;
    const baselineModule = window.MindNookBaseline;
    if (!utilityModule) {
      return { tau: computeTau(cfp, cfn), pIntervention: null, shouldIntervene: null, actions: [] };
    }
    if (baselineModule && typeof baselineModule.buildUtilityScore === 'function') {
      const result = baselineModule.buildUtilityScore(
        SCENARIO.l1, SCENARIO.l2, SCENARIO.l3, SCENARIO.l4,
        { cfp_weight: cfp, cfn_weight: cfn, ...weights, autonomy_preference: 0.5 },
        SCENARIO.entryHistory,
        { sentiment: true, pragmatic: true, temporal: true, goal_inference: true, ai_full_history: true }
      );
      const actions = ['support', 'intervene', 'reflect'].map(action => {
        const found = (result.allActions || []).find(r => r.action === action);
        return found ? { action, utility: found.utility, breakdown: found.breakdown } : { action, utility: 0, breakdown: null };
      });
      return { tau: result.tau, pIntervention: result.pIntervention, shouldIntervene: result.shouldIntervene, actions };
    }
    const z = { l1: SCENARIO.l1, l2: SCENARIO.l2, l3: SCENARIO.l3, l4: SCENARIO.l4, entryHistory: SCENARIO.entryHistory, inferenceDepth: 0, autonomyPreference: 0.5 };
    const actions = ['support', 'intervene', 'reflect'].map(action => {
      const r = utilityModule.computeDecomposedUtility(action, z, weights);
      return { action, utility: r.utility, breakdown: r.breakdown };
    });
    return { tau: computeTau(cfp, cfn), pIntervention: null, shouldIntervene: null, actions };
  }

  function renderCalibrationWizard(containerEl, opts) {
    injectStyleFallback();
    if (!containerEl) return null;
    const options = opts || {};
    let cfp = clamp(options.initialCfp != null ? options.initialCfp : PRESETS.balanced.cfp, 0.1, 0.9);
    let cfn = clamp(options.initialCfn != null ? options.initialCfn : PRESETS.balanced.cfn, 0.1, 0.9);
    let weights = { ...DEFAULT_WEIGHTS, ...(options.initialWeights || {}) };
    const showSaveButton = !!options.showSaveButton;
    const showWeightSliders = options.showWeightSliders !== false && !!(window.MindNookUtility && window.MindNookUtility.WEIGHTS_CONFIGURABLE);

    const wrap = document.createElement('div');
    wrap.className = 'mn-calib-wizard';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'AI response sensitivity calibration');

    wrap.innerHTML = `
      <div class="mn-calib-presets" role="group" aria-label="Quick presets">
        <button type="button" class="mn-calib-preset-btn" data-preset="minimal">Minimal</button>
        <button type="button" class="mn-calib-preset-btn" data-preset="balanced">Balanced</button>
        <button type="button" class="mn-calib-preset-btn" data-preset="proactive">Proactive</button>
      </div>
      <div class="mn-calib-slider-row">
        <label class="mn-calib-slider-label" for="mnCalibCfp">Cost of a false positive (unnecessary check-in)</label>
        <input type="range" id="mnCalibCfp" class="mn-calib-slider" min="0.1" max="0.9" step="0.01" value="${cfp}" aria-valuemin="0.1" aria-valuemax="0.9" aria-valuenow="${cfp}">
        <div class="mn-calib-slider-value" id="mnCalibCfpVal" aria-hidden="true">${cfp.toFixed(2)}</div>
      </div>
      <div class="mn-calib-slider-row">
        <label class="mn-calib-slider-label" for="mnCalibCfn">Cost of a false negative (missed check-in)</label>
        <input type="range" id="mnCalibCfn" class="mn-calib-slider" min="0.1" max="0.9" step="0.01" value="${cfn}" aria-valuemin="0.1" aria-valuemax="0.9" aria-valuenow="${cfn}">
        <div class="mn-calib-slider-value" id="mnCalibCfnVal" aria-hidden="true">${cfn.toFixed(2)}</div>
      </div>
      <div class="mn-calib-tau-block">
        <div class="mn-calib-tau-label">Resulting threshold (&tau;*)</div>
        <div class="mn-calib-tau-value" id="mnCalibTauVal">0.00</div>
        <div class="mn-calib-tau-bar" role="img" aria-label="Threshold position on a 0 to 1 scale">
          <div class="mn-calib-tau-bar-fill" id="mnCalibTauFill"></div>
          <div class="mn-calib-tau-bar-marker" id="mnCalibTauMarker"></div>
        </div>
      </div>
      ${showWeightSliders ? `
      <details class="mn-calib-advanced">
        <summary>Advanced: utility weights</summary>
        <div class="mn-calib-slider-row">
          <label class="mn-calib-slider-label" for="mnCalibWTask">Task appropriateness weight</label>
          <input type="range" id="mnCalibWTask" class="mn-calib-slider" min="0" max="1" step="0.01" value="${weights.w_task}">
          <div class="mn-calib-slider-value" id="mnCalibWTaskVal" aria-hidden="true">${weights.w_task.toFixed(2)}</div>
        </div>
        <div class="mn-calib-slider-row">
          <label class="mn-calib-slider-label" for="mnCalibWSafety">Safety weight</label>
          <input type="range" id="mnCalibWSafety" class="mn-calib-slider" min="0" max="1" step="0.01" value="${weights.w_safety}">
          <div class="mn-calib-slider-value" id="mnCalibWSafetyVal" aria-hidden="true">${weights.w_safety.toFixed(2)}</div>
        </div>
        <div class="mn-calib-slider-row">
          <label class="mn-calib-slider-label" for="mnCalibLambdaPrivacy">Privacy cost weight</label>
          <input type="range" id="mnCalibLambdaPrivacy" class="mn-calib-slider" min="0" max="1" step="0.01" value="${weights.lambda_privacy}">
          <div class="mn-calib-slider-value" id="mnCalibLambdaPrivacyVal" aria-hidden="true">${weights.lambda_privacy.toFixed(2)}</div>
        </div>
        <div class="mn-calib-slider-row">
          <label class="mn-calib-slider-label" for="mnCalibLambdaAutonomy">Autonomy cost weight</label>
          <input type="range" id="mnCalibLambdaAutonomy" class="mn-calib-slider" min="0" max="1" step="0.01" value="${weights.lambda_autonomy}">
          <div class="mn-calib-slider-value" id="mnCalibLambdaAutonomyVal" aria-hidden="true">${weights.lambda_autonomy.toFixed(2)}</div>
        </div>
      </details>` : ''}
      <div class="mn-calib-example">
        <div class="mn-calib-example-label">Worked example — a message with a difficult tone, a stable recent pattern, and a well-aligned goal</div>
        <div class="mn-calib-example-cards" id="mnCalibExampleCards" aria-live="polite"></div>
      </div>
      ${showSaveButton ? '<button type="button" class="mn-calib-save-btn" id="mnCalibSaveBtn">Save calibration</button><div class="mn-calib-save-status" id="mnCalibSaveStatus" role="status" aria-live="polite"></div>' : ''}
    `;
    containerEl.appendChild(wrap);

    const cfpSlider = wrap.querySelector('#mnCalibCfp');
    const cfnSlider = wrap.querySelector('#mnCalibCfn');
    const cfpVal = wrap.querySelector('#mnCalibCfpVal');
    const cfnVal = wrap.querySelector('#mnCalibCfnVal');
    const tauVal = wrap.querySelector('#mnCalibTauVal');
    const tauFill = wrap.querySelector('#mnCalibTauFill');
    const tauMarker = wrap.querySelector('#mnCalibTauMarker');
    const exampleCards = wrap.querySelector('#mnCalibExampleCards');
    const presetBtns = wrap.querySelectorAll('.mn-calib-preset-btn');
    const wTaskSlider = wrap.querySelector('#mnCalibWTask');
    const wSafetySlider = wrap.querySelector('#mnCalibWSafety');
    const lambdaPrivacySlider = wrap.querySelector('#mnCalibLambdaPrivacy');
    const lambdaAutonomySlider = wrap.querySelector('#mnCalibLambdaAutonomy');
    const wTaskVal = wrap.querySelector('#mnCalibWTaskVal');
    const wSafetyVal = wrap.querySelector('#mnCalibWSafetyVal');
    const lambdaPrivacyVal = wrap.querySelector('#mnCalibLambdaPrivacyVal');
    const lambdaAutonomyVal = wrap.querySelector('#mnCalibLambdaAutonomyVal');

    function activePresetName() {
      return Object.keys(PRESETS).find(name => Math.abs(PRESETS[name].cfp - cfp) < 0.005 && Math.abs(PRESETS[name].cfn - cfn) < 0.005) || null;
    }

    function updatePresetHighlight() {
      const active = activePresetName();
      presetBtns.forEach(btn => {
        const isActive = btn.getAttribute('data-preset') === active;
        btn.classList.toggle('selected', isActive);
        btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
    }

    function currentValues() {
      return { cfp, cfn, tau: computeTau(cfp, cfn), ...weights };
    }

    function renderExample() {
      const result = computeExample(cfp, cfn, weights);
      exampleCards.innerHTML = '';
      const utilities = result.actions.map(a => a.utility);
      const maxUtility = utilities.length ? Math.max(...utilities) : null;
      result.actions.forEach(a => {
        const meta = ACTION_META[a.action] || { label: a.action, desc: '' };
        const isBest = maxUtility != null && a.utility === maxUtility;
        const card = document.createElement('div');
        card.className = 'mn-calib-example-card' + (isBest ? ' mn-calib-example-best' : '');
        card.innerHTML = `
          <div class="mn-calib-example-card-title">${meta.label}${isBest ? '<span class="mn-calib-example-badge">Selected</span>' : ''}</div>
          <div class="mn-calib-example-card-desc">${meta.desc}</div>
          <div class="mn-calib-example-card-utility">E[U] = ${a.utility.toFixed(3)}</div>`;
        exampleCards.appendChild(card);
      });
      if (window.MindNookA11y) {
        const bestMeta = ACTION_META[(result.actions.find(a => a.utility === maxUtility) || {}).action];
        if (bestMeta) {
          window.MindNookA11y.announce(`At these settings, the selected response is ${bestMeta.label}.`, 'polite');
        }
      }
    }

    const debouncedRenderExample = debounce(renderExample, 150);

    function updateTauDisplay() {
      const tau = computeTau(cfp, cfn);
      tauVal.textContent = tau.toFixed(2);
      tauFill.style.width = (tau * 100) + '%';
      tauMarker.style.left = (tau * 100) + '%';
      cfpSlider.setAttribute('aria-valuenow', cfp.toFixed(2));
      cfnSlider.setAttribute('aria-valuenow', cfn.toFixed(2));
    }

    function emitChange() {
      updatePresetHighlight();
      updateTauDisplay();
      debouncedRenderExample();
      if (typeof options.onChange === 'function') {
        options.onChange(currentValues());
      }
    }

    cfpSlider.addEventListener('input', () => {
      cfp = clamp(parseFloat(cfpSlider.value), 0.1, 0.9);
      cfpVal.textContent = cfp.toFixed(2);
      emitChange();
    });
    cfnSlider.addEventListener('input', () => {
      cfn = clamp(parseFloat(cfnSlider.value), 0.1, 0.9);
      cfnVal.textContent = cfn.toFixed(2);
      emitChange();
    });

    if (wTaskSlider) {
      wTaskSlider.addEventListener('input', () => {
        weights.w_task = parseFloat(wTaskSlider.value);
        wTaskVal.textContent = weights.w_task.toFixed(2);
        emitChange();
      });
    }
    if (wSafetySlider) {
      wSafetySlider.addEventListener('input', () => {
        weights.w_safety = parseFloat(wSafetySlider.value);
        wSafetyVal.textContent = weights.w_safety.toFixed(2);
        emitChange();
      });
    }
    if (lambdaPrivacySlider) {
      lambdaPrivacySlider.addEventListener('input', () => {
        weights.lambda_privacy = parseFloat(lambdaPrivacySlider.value);
        lambdaPrivacyVal.textContent = weights.lambda_privacy.toFixed(2);
        emitChange();
      });
    }
    if (lambdaAutonomySlider) {
      lambdaAutonomySlider.addEventListener('input', () => {
        weights.lambda_autonomy = parseFloat(lambdaAutonomySlider.value);
        lambdaAutonomyVal.textContent = weights.lambda_autonomy.toFixed(2);
        emitChange();
      });
    }

    presetBtns.forEach(btn => {
      const activate = () => {
        const presetName = btn.getAttribute('data-preset');
        const preset = PRESETS[presetName];
        if (!preset) return;
        cfp = preset.cfp;
        cfn = preset.cfn;
        cfpSlider.value = String(cfp);
        cfnSlider.value = String(cfn);
        cfpVal.textContent = cfp.toFixed(2);
        cfnVal.textContent = cfn.toFixed(2);
        emitChange();
      };
      if (window.MindNookA11y) {
        window.MindNookA11y.bindActivation(btn, activate);
      } else {
        btn.addEventListener('click', activate);
      }
    });

    if (showSaveButton) {
      const saveBtn = wrap.querySelector('#mnCalibSaveBtn');
      const saveStatus = wrap.querySelector('#mnCalibSaveStatus');
      saveBtn.addEventListener('click', async () => {
        if (typeof options.onSave !== 'function') return;
        saveBtn.disabled = true;
        saveStatus.textContent = 'Saving…';
        try {
          await options.onSave(currentValues());
          saveStatus.textContent = 'Calibration saved.';
        } catch (e) {
          saveStatus.textContent = 'Could not save — please try again.';
        } finally {
          saveBtn.disabled = false;
        }
      });
    }

    updatePresetHighlight();
    updateTauDisplay();
    renderExample();

    return {
      getValues: currentValues,
      setValues(next) {
        if (!next) return;
        if (next.cfp != null) { cfp = clamp(next.cfp, 0.1, 0.9); cfpSlider.value = String(cfp); cfpVal.textContent = cfp.toFixed(2); }
        if (next.cfn != null) { cfn = clamp(next.cfn, 0.1, 0.9); cfnSlider.value = String(cfn); cfnVal.textContent = cfn.toFixed(2); }
        weights = { ...weights, ...next };
        emitChange();
      },
      destroy() {
        wrap.remove();
      },
    };
  }

  return { renderCalibrationWizard, PRESETS };
})();
if (typeof module !== 'undefined' && module.exports) { module.exports = window.MindNookCalibrationWizard; }