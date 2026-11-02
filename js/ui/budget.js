// ui/budget.js — tax and spending sliders with a live budget preview.
window.Mayor = window.Mayor || {};
Mayor.ui = Mayor.ui || {};

(function () {
  const U = Mayor.util;
  const $ = (id) => document.getElementById(id);

  const TAXES = [
    { key: 'income', name: 'Income tax', desc: 'Paid by workers. Residents feel it directly.' },
    { key: 'business', name: 'Business tax', desc: 'Paid on profits. High rates scare businesses away.' },
    { key: 'sales', name: 'Sales tax', desc: 'Paid on shopping. Residents feel it and it slows the economy.' },
  ];
  const SPENDING = [
    { key: 'education', name: 'Education', desc: 'Schools. Boosts productivity and growth.' },
    { key: 'healthcare', name: 'Healthcare', desc: 'Clinics and hospitals. Residents care a lot.' },
    { key: 'safety', name: 'Public safety', desc: 'Police and fire. Residents care a lot.' },
    { key: 'infrastructure', name: 'Infrastructure', desc: 'Roads, water, power. Businesses love it.' },
    { key: 'parks', name: 'Parks & culture', desc: 'Green space, libraries, events.' },
  ];

  let state = null;
  let onChange = () => {};

  function setFill(input) {
    const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--fill', `${pct}%`);
  }

  function sliderHtml(id, name, desc, min, max, step, value) {
    return `
      <div class="slider">
        <div class="slider-head">
          <div><div class="slider-name">${name}</div><div class="slider-desc">${desc}</div></div>
          <span class="slider-value" id="${id}-value"></span>
        </div>
        <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${name}">
        <div class="slider-foot" id="${id}-foot"></div>
      </div>`;
  }

  // Builds the sliders once. update() keeps them in sync with the state afterwards.
  function init(handlers) {
    onChange = handlers.onChange;
    const C = Mayor.config;

    $('tax-sliders').innerHTML = TAXES.map((t) => {
      const lim = C.taxLimits[t.key];
      return sliderHtml(`tax-${t.key}`, t.name, t.desc, lim.min, lim.max, lim.step, 0);
    }).join('');

    $('spend-sliders').innerHTML = SPENDING.map((s) => {
      const lim = C.budgetLimits[s.key];
      return sliderHtml(`spend-${s.key}`, s.name, s.desc, lim.min, lim.max, C.budgetStep, 0);
    }).join('') + sliderHtml('spend-welfare', 'Unemployment benefits',
      'Paid to each jobless resident. Softens the anger unemployment causes.',
      C.welfareLimits.min, C.welfareLimits.max, C.welfareLimits.step, 0);

    for (const t of TAXES) {
      $(`tax-${t.key}`).addEventListener('input', (e) => {
        state.policies.taxes[t.key] = Number(e.target.value);
        changed();
      });
    }
    for (const s of SPENDING) {
      $(`spend-${s.key}`).addEventListener('input', (e) => {
        state.policies.budget[s.key] = Number(e.target.value);
        changed();
      });
    }
    $('spend-welfare').addEventListener('input', (e) => {
      state.policies.welfare = Number(e.target.value);
      changed();
    });

    $('budget-summary').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-repay]');
      if (btn) handlers.onRepay(btn.dataset.repay === 'all' ? Infinity : Number(btn.dataset.repay));
    });
  }

  function changed() {
    renderValues();
    renderSummary();
    onChange();
  }

  function renderValues() {
    const bonus = Mayor.economy.getBonuses(state);
    for (const t of TAXES) {
      const input = $(`tax-${t.key}`);
      input.value = state.policies.taxes[t.key];
      setFill(input);
      $(`tax-${t.key}-value`).textContent = U.pct(state.policies.taxes[t.key]);
    }
    const budget = Mayor.economy.projectBudget(state, bonus);
    $('tax-income-foot').innerHTML = `<span>Raises ${U.money(budget.revenue.income)}/qtr</span>`;
    $('tax-business-foot').innerHTML = `<span>Raises ${U.money(budget.revenue.business)}/qtr</span><span>Business climate ${state.climate.toFixed(0)}</span>`;
    $('tax-sales-foot').innerHTML = `<span>Raises ${U.money(budget.revenue.sales)}/qtr</span>`;

    for (const s of SPENDING) {
      const input = $(`spend-${s.key}`);
      input.value = state.policies.budget[s.key];
      setFill(input);
      $(`spend-${s.key}-value`).textContent = U.money(state.policies.budget[s.key]);
      const now = state.services[s.key];
      const target = Mayor.economy.serviceTarget(state, s.key, bonus);
      const perCapita = state.policies.budget[s.key] / state.population;
      $(`spend-${s.key}-foot`).innerHTML =
        `<span>$${perCapita.toFixed(0)} per resident</span><span>Quality ${now.toFixed(0)} → <b class="${target >= now ? 'pos' : 'neg'}">${target.toFixed(0)}</b></span>`;
    }

    const w = $('spend-welfare');
    w.value = state.policies.welfare;
    setFill(w);
    $('spend-welfare-value').textContent = `$${U.int(state.policies.welfare)}`;
    $('spend-welfare-foot').innerHTML = `<span>per jobless resident</span><span>Costs ${U.money(budget.expenses.welfare)}/qtr</span>`;
  }

  function renderSummary() {
    const b = Mayor.economy.projectBudget(state);
    const line = (label, v) => `<div class="line"><span>${label}</span><span>${U.money(v)}</span></div>`;
    const burden = Mayor.economy.taxBurden(state.policies.taxes);
    const burdenTone = burden > Mayor.config.happiness.taxThreshold ? 'chip--warn' : 'chip--good';

    $('budget-summary').innerHTML = `
      <h3 class="card-title">Next quarter forecast</h3>
      <div class="net-box ${b.net >= 0 ? 'net-box--good' : 'net-box--bad'}">
        <div class="label">${b.net >= 0 ? 'Surplus' : 'Deficit'}</div>
        <div class="value">${U.signed(U.money(b.net), b.net)}</div>
      </div>
      <div class="summary-section">
        <h4>Revenue</h4>
        ${line('Income tax', b.revenue.income)}
        ${line('Business tax', b.revenue.business)}
        ${line('Sales tax', b.revenue.sales)}
        ${b.revenue.other ? line('Other income', b.revenue.other) : ''}
        <div class="line line--total"><span>Total</span><span>${U.money(b.revenue.total)}</span></div>
      </div>
      <div class="summary-section">
        <h4>Spending</h4>
        ${line('City services', b.expenses.education + b.expenses.healthcare + b.expenses.safety + b.expenses.infrastructure + b.expenses.parks)}
        ${line('Unemployment benefits', b.expenses.welfare)}
        ${b.expenses.upkeep ? line('Project upkeep', b.expenses.upkeep) : ''}
        ${b.expenses.interest ? line('Debt interest', b.expenses.interest) : ''}
        ${b.expenses.other ? line('Emergencies', b.expenses.other) : ''}
        <div class="line line--total"><span>Total</span><span>${U.money(b.expenses.total)}</span></div>
      </div>
      <div class="summary-section">
        <h4>Tax burden</h4>
        <div class="line"><span>Felt by residents</span><span class="chip ${burdenTone}">${U.pct(burden)}</span></div>
        <p class="hint">Above ${U.pct(Mayor.config.happiness.taxThreshold, 0)}, residents get unhappy.</p>
      </div>
      <div class="summary-section">
        <h4>Debt</h4>
        <div class="line"><span>Owed</span><span>${U.money(state.debt)}</span></div>
        <div class="line"><span>Interest rate</span><span>${U.pct(b.rating.rate)} (${b.rating.grade})</span></div>
        ${state.debt > 0 ? `
          <div class="debt-actions">
            <button class="btn btn--small" data-repay="10000000" ${state.treasury < 1 ? 'disabled' : ''}>Repay $10M</button>
            <button class="btn btn--small btn--primary" data-repay="all" ${state.treasury < 1 ? 'disabled' : ''}>Repay max</button>
          </div>` : '<p class="hint">No debt. If the treasury runs out, the city borrows automatically.</p>'}
      </div>`;
  }

  function update(newState) {
    state = newState;
    renderValues();
    renderSummary();
    const disabled = state.status !== 'playing';
    document.querySelectorAll('#tab-budget input[type="range"]').forEach((i) => { i.disabled = disabled; });
  }

  Mayor.ui.budget = { init, update };
})();
