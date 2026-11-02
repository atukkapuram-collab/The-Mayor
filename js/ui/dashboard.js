// ui/dashboard.js — top bar, KPI cards, services and advisor.
window.Mayor = window.Mayor || {};
Mayor.ui = Mayor.ui || {};

(function () {
  const U = Mayor.util;
  const $ = (id) => document.getElementById(id);

  // The five headline stats. higherIsBetter decides the delta color.
  const KPIS = [
    { key: 'treasury', label: 'Treasury', format: (v) => U.money(v), higherIsBetter: true, title: 'Cash the city has on hand' },
    { key: 'population', label: 'Population', format: (v) => U.int(v), higherIsBetter: true, title: 'Residents. They move in when the city is happy and has jobs.' },
    { key: 'gdp', label: 'GDP (yearly)', format: (v) => U.money(v * 4), higherIsBetter: true, title: 'Total value of everything the city economy produces in a year' },
    { key: 'unemployment', label: 'Unemployment', format: (v) => U.pct(v), higherIsBetter: false, title: 'Share of workers without a job' },
    { key: 'happiness', label: 'Happiness', format: (v) => `${v.toFixed(0)}`, higherIsBetter: true, title: 'How residents feel about the city (0–100). Below 20 for 3 quarters and you are recalled.' },
  ];

  const shown = {}; // last value shown per KPI, for the count-up animation

  function sparkline(values, color) {
    if (values.length < 2) return '<svg class="sparkline"></svg>';
    const w = 72, h = 26, pad = 2;
    const min = Math.min(...values), max = Math.max(...values);
    const span = max - min || 1;
    const pts = values.map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / span) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `<svg class="sparkline" viewBox="0 0 ${w} ${h}"><path d="M${pts.join('L')}" stroke="${color}"/></svg>`;
  }

  function happinessColor(v) {
    return v >= 60 ? 'var(--good)' : v >= 40 ? 'var(--warn)' : 'var(--bad)';
  }

  function moodWord(v) {
    if (v >= 80) return 'Thrilled';
    if (v >= 65) return 'Content';
    if (v >= 50) return 'Okay';
    if (v >= 35) return 'Frustrated';
    if (v >= 20) return 'Angry';
    return 'Furious';
  }

  function deltaText(kpi, now, before) {
    const diff = now - before;
    if (Math.abs(diff) < 1e-9) return { text: '—', cls: 'delta--flat' };
    let text;
    if (kpi.key === 'unemployment') text = `${diff > 0 ? '+' : '−'}${Math.abs(diff * 100).toFixed(1)} pts`;
    else if (kpi.key === 'happiness') text = `${diff > 0 ? '+' : '−'}${Math.abs(diff).toFixed(1)}`;
    else if (kpi.key === 'treasury') text = `${diff > 0 ? '+' : ''}${U.money(diff)}`;
    else text = `${diff > 0 ? '+' : '−'}${Math.abs((diff / before) * 100).toFixed(1)}%`;
    const good = kpi.higherIsBetter ? diff > 0 : diff < 0;
    return { text, cls: good ? 'delta--good' : 'delta--bad', good };
  }

  // Smoothly counts a number from its old value to the new one
  function animateValue(el, kpi, from, to) {
    if (from === undefined || from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = kpi.format(to);
      return;
    }
    const start = performance.now();
    const duration = 700;
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = kpi.format(from + (to - from) * eased);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function renderKpis(state, { flash = false } = {}) {
    const root = $('kpis');
    if (!root.children.length) {
      root.innerHTML = KPIS.map((k) => `
        <article class="kpi" id="kpi-${k.key}" title="${k.title}">
          <div class="kpi-label"><span>${k.label}</span><span class="delta"></span></div>
          <div class="kpi-value"></div>
          <div class="kpi-sub"></div>
        </article>`).join('');
    }

    const hist = state.history;
    const last = hist[hist.length - 1];
    const before = hist[hist.length - 2] || last;
    const recent = hist.slice(-12);

    for (const k of KPIS) {
      const card = $(`kpi-${k.key}`);
      const value = state[k.key];
      const d = deltaText(k, last[k.key], before[k.key]);
      card.querySelector('.delta').className = `delta ${d.cls}`;
      card.querySelector('.delta').textContent = d.text;
      animateValue(card.querySelector('.kpi-value'), k, shown[k.key], value);
      shown[k.key] = value;

      const color = d.cls === 'delta--bad' ? 'var(--bad)' : d.cls === 'delta--good' ? 'var(--good)' : 'var(--accent)';
      let sub;
      if (k.key === 'treasury') sub = `<span>Debt ${U.money(state.debt)}</span>`;
      else if (k.key === 'happiness') sub = `<span style="color:${happinessColor(value)}">${moodWord(value)}</span>`;
      else if (k.key === 'gdp') sub = `<span>${U.money(state.gdp * 4 / state.population, 0)} / person</span>`;
      else if (k.key === 'unemployment') sub = `<span>${U.int(state.population * Mayor.config.economy.laborShare * value)} jobless</span>`;
      else sub = `<span>Climate ${state.climate.toFixed(0)}</span>`;

      if (k.key === 'happiness') {
        sub = `<div style="flex:1"><div class="meter"><span style="width:${value}%;background:${happinessColor(value)}"></span></div>${sub}</div>`;
      }
      card.querySelector('.kpi-sub').innerHTML = sub + sparkline(recent.map((h) => h[k.key]), color);

      if (flash && d.cls !== 'delta--flat') {
        card.classList.remove('flash-good', 'flash-bad');
        void card.offsetWidth; // restart the animation
        card.classList.add(d.good ? 'flash-good' : 'flash-bad');
      }
    }
  }

  function renderTopbar(state) {
    const C = Mayor.config;
    $('city-title').textContent = state.cityName;
    $('date-label').textContent = U.dateLabel(state.turn);
    const left = C.TOTAL_TURNS - state.turn;
    $('turns-left').textContent = `${left} quarter${left === 1 ? '' : 's'} left`;
    $('term-progress-fill').style.width = `${(state.turn / C.TOTAL_TURNS) * 100}%`;

    const rating = Mayor.economy.projectBudget(state).rating;
    const chip = $('rating-chip');
    chip.textContent = `${rating.grade} credit`;
    const idx = C.debt.ratings.findIndex((r) => r.grade === rating.grade);
    chip.className = `chip ${idx <= 2 ? 'chip--good' : idx <= 4 ? 'chip--warn' : 'chip--bad'}`;
    chip.title = `Credit rating ${rating.grade}: you pay ${U.pct(rating.rate)} a year on debt. It drops as debt grows compared to revenue.`;

    const btn = $('end-turn-btn');
    btn.disabled = state.status !== 'playing' || !!state.pendingEvent;
    btn.firstChild.textContent = state.turn === C.TOTAL_TURNS - 1 ? 'Finish Term ' : 'End Quarter ';
  }

  const SERVICE_LABELS = { education: 'Education', healthcare: 'Healthcare', safety: 'Safety', infrastructure: 'Infrastructure', parks: 'Parks' };

  function renderServices(state) {
    const bonus = Mayor.economy.getBonuses(state);
    $('services-list').innerHTML = Mayor.state.SERVICES.map((name) => {
      const v = state.services[name];
      const target = Mayor.economy.serviceTarget(state, name, bonus);
      const arrow = target > v + 1 ? '<span class="pos" title="Improving">▲</span>' : target < v - 1 ? '<span class="neg" title="Declining">▼</span>' : '';
      return `
        <div class="service-row" title="Heading toward ${target.toFixed(0)} with the current budget">
          <span>${SERVICE_LABELS[name]} ${arrow}</span>
          <div class="meter"><span style="width:${v}%;background:${happinessColor(v)}"></span></div>
          <span class="num">${v.toFixed(0)}</span>
        </div>`;
    }).join('');
  }

  function renderAdvisor(state) {
    $('advisor-list').innerHTML = Mayor.game.getAdvice(state)
      .map((t) => `<li><span class="dot dot--${t.tone}"></span><span>${U.escapeHtml(t.text)}</span></li>`)
      .join('');
  }

  // Draws a random city skyline for the title screen
  function drawSkyline() {
    const svg = $('skyline');
    const W = 1600, H = 280;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let html = '';
    for (const layer of [{ fill: 'var(--skyline-2)', minH: 60, maxH: 200, win: false }, { fill: 'var(--skyline-1)', minH: 40, maxH: 160, win: true }]) {
      let x = -20;
      while (x < W) {
        const w = 40 + rnd() * 70;
        const h = layer.minH + rnd() * (layer.maxH - layer.minH);
        html += `<rect x="${x.toFixed(0)}" y="${(H - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="${layer.fill}"/>`;
        if (layer.win) {
          for (let wy = H - h + 12; wy < H - 14; wy += 16) {
            for (let wx = x + 8; wx < x + w - 10; wx += 13) {
              if (rnd() < 0.22) html += `<rect x="${wx.toFixed(0)}" y="${wy.toFixed(0)}" width="5" height="7" fill="var(--window)"/>`;
            }
          }
        }
        x += w + 2 + rnd() * 6;
      }
    }
    svg.innerHTML = html;
  }

  function resetAnimations() {
    for (const key of Object.keys(shown)) delete shown[key];
  }

  Mayor.ui.dashboard = { renderKpis, renderTopbar, renderServices, renderAdvisor, drawSkyline, resetAnimations, happinessColor };
})();
