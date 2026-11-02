// ui/finalReport.js — the end-of-term report card.
window.Mayor = window.Mayor || {};
Mayor.ui = Mayor.ui || {};

(function () {
  const U = Mayor.util;

  const LOSS_TEXT = {
    bankrupt: 'Debt grew to more than three times the city\'s yearly revenue. The state has taken control of city finances.',
    recalled: 'Residents were deeply unhappy for three quarters in a row and voted to remove you from office.',
  };

  function render(state, handlers) {
    const result = Mayor.scoring.calculate(state);
    const first = state.history[0];
    const years = (state.turn / 4).toFixed(state.turn % 4 ? 1 : 0);
    const built = state.projects.filter((p) => p.turnsLeft === 0).map((p) => Mayor.projects.get(p.id).name);

    const compare = (label, a, b, fmt) => `<tr><td>${label}</td><td>${fmt(a)}</td><td>${fmt(b)}</td></tr>`;

    const root = document.getElementById('final-screen');
    root.innerHTML = `
      <div class="final-hero">
        <div class="grade-ring" style="--p:${result.total / 10}"><span class="grade">${result.grade}</span></div>
        <div>
          <p class="eyebrow">${state.status === 'lost' ? 'Term cut short' : 'Term complete'} · ${U.escapeHtml(state.cityName)}</p>
          <h1>${result.title}</h1>
          <p class="final-score"><b id="final-score-num">0</b> / 1000 points · ${years} years in office</p>
          ${state.status === 'lost' ? `<p class="muted" style="margin-top:8px">${LOSS_TEXT[state.lossReason]}</p>` : ''}
        </div>
      </div>

      <div class="final-grid">
        <div class="card">
          <h3 class="card-title">Score breakdown</h3>
          ${result.parts.map((p) => `
            <div class="breakdown-row">
              <span>${p.label} <small>· ${p.detail}</small></span>
              <b>${p.points} / ${p.weight * 1000}</b>
              <div class="meter"><span style="width:${p.value * 100}%"></span></div>
            </div>`).join('')}
          ${state.status === 'lost' ? '<p class="hint">Losing early halves your score and scales it by the time you served.</p>' : ''}
        </div>
        <div class="card">
          <h3 class="card-title">Then and now</h3>
          <table class="ledger compare-table">
            <thead><tr><th></th><th>Start</th><th>End</th></tr></thead>
            <tbody>
              ${compare('Population', first.population, state.population, U.int)}
              ${compare('GDP (yearly)', first.gdp * 4, state.gdp * 4, (v) => U.money(v))}
              ${compare('Unemployment', first.unemployment, state.unemployment, (v) => U.pct(v))}
              ${compare('Happiness', first.happiness, state.happiness, (v) => v.toFixed(0))}
              ${compare('Treasury', first.treasury, state.treasury, (v) => U.money(v))}
              ${compare('Debt', first.debt, state.debt, (v) => U.money(v))}
            </tbody>
          </table>
          <p class="hint" style="margin-top:12px">${state.eventsSeen.length} events handled · ${built.length ? `Built: ${built.join(', ')}` : 'No projects completed'}</p>
        </div>
        <div class="card chart-card wide">
          <h3 class="card-title">Your term at a glance</h3>
          <div class="chart-box"><canvas id="final-chart-economy"></canvas></div>
        </div>
        <div class="card chart-card wide">
          <h3 class="card-title">Happiness and unemployment</h3>
          <div class="chart-box"><canvas id="final-chart-wellbeing"></canvas></div>
        </div>
      </div>

      <div class="final-actions">
        <button class="btn btn--accent" id="play-again-btn">Start a new term</button>
        <button class="btn" id="final-menu-btn">Main menu</button>
      </div>`;

    document.getElementById('play-again-btn').addEventListener('click', handlers.onNewGame);
    document.getElementById('final-menu-btn').addEventListener('click', handlers.onMenu);

    Mayor.ui.charts.draw('economy', state.history, 'final-chart-economy');
    Mayor.ui.charts.draw('wellbeing', state.history, 'final-chart-wellbeing');

    // Count the score up
    const el = document.getElementById('final-score-num');
    const start = performance.now();
    (function tick(now) {
      const t = Math.min(1, (now - start) / 1400);
      el.textContent = Math.round(result.total * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  }

  Mayor.ui.finalReport = { render };
})();
