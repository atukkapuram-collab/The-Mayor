// ui/charts.js — history charts drawn with Chart.js.
// If Chart.js could not load (for example, offline), a short message is shown instead.
window.Mayor = window.Mayor || {};
Mayor.ui = Mayor.ui || {};

(function () {
  const U = Mayor.util;
  const charts = {};

  function css(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function label(turn) {
    const d = U.dateOf(turn);
    return `Y${d.year} Q${d.quarter}`;
  }

  function baseOptions(axes) {
    const grid = css('--border');
    const text = css('--text-muted');
    const scales = { x: { grid: { display: false }, ticks: { color: text, maxTicksLimit: 8, maxRotation: 0 } } };
    for (const [id, a] of Object.entries(axes)) {
      scales[id] = {
        position: a.position || 'left',
        grid: { color: grid, drawOnChartArea: a.position !== 'right' },
        ticks: { color: text, maxTicksLimit: 5, callback: a.format },
        min: a.min, max: a.max,
        border: { display: false },
      };
    }
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: text, boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', font: { family: css('--font') } } },
        tooltip: {
          backgroundColor: css('--surface-solid'), titleColor: css('--text'), bodyColor: css('--text-muted'),
          borderColor: css('--border-strong'), borderWidth: 1, padding: 10, cornerRadius: 8,
          callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${ctx.dataset.format(ctx.parsed.y)}` },
        },
      },
      scales,
    };
  }

  function line(labelText, data, color, format, yAxisID = 'y', fill = false) {
    return {
      type: 'line', label: labelText, data, yAxisID, format,
      borderColor: color, backgroundColor: color + '22', fill,
      borderWidth: 2.5, tension: 0.35, pointRadius: 0, pointHoverRadius: 4,
    };
  }

  // Each chart: which canvas, how to build datasets from history, and its axes
  const DEFS = {
    economy: {
      canvas: 'chart-economy',
      axes: { y: { format: (v) => U.money(v) }, y2: { position: 'right', format: (v) => `${Math.round(v / 1000)}K` } },
      datasets: (h) => [
        line('GDP (yearly)', h.map((x) => x.gdp * 4), css('--series-1'), (v) => U.money(v), 'y', true),
        line('Population', h.map((x) => x.population), css('--series-2'), (v) => U.int(v), 'y2'),
      ],
    },
    wellbeing: {
      canvas: 'chart-wellbeing',
      axes: { y: { min: 0, max: 100, format: (v) => v }, y2: { position: 'right', min: 0, format: (v) => `${v}%` } },
      datasets: (h) => [
        line('Happiness', h.map((x) => x.happiness), css('--series-3'), (v) => v.toFixed(0), 'y', true),
        line('Unemployment', h.map((x) => x.unemployment * 100), css('--series-4'), (v) => `${v.toFixed(1)}%`, 'y2'),
      ],
    },
    budget: {
      canvas: 'chart-budget',
      type: 'bar',
      axes: { y: { format: (v) => U.money(v) } },
      datasets: (h) => [
        { type: 'bar', label: 'Revenue', data: h.map((x) => x.revenue), backgroundColor: css('--series-2'), borderRadius: 4, format: (v) => U.money(v) },
        { type: 'bar', label: 'Spending', data: h.map((x) => x.expenses), backgroundColor: css('--series-4'), borderRadius: 4, format: (v) => U.money(v) },
      ],
    },
    finance: {
      canvas: 'chart-finance',
      axes: { y: { min: 0, format: (v) => U.money(v) } },
      datasets: (h) => [
        line('Treasury', h.map((x) => x.treasury), css('--series-1'), (v) => U.money(v), 'y', true),
        line('Debt', h.map((x) => x.debt), css('--series-4'), (v) => U.money(v)),
      ],
    },
  };

  function showFallback(canvas) {
    const box = canvas.parentElement;
    if (!box.querySelector('.chart-fallback')) {
      canvas.hidden = true;
      box.insertAdjacentHTML('beforeend', '<div class="chart-fallback">Charts need an internet connection the first time the game loads.</div>');
    }
  }

  function draw(key, history, canvasId) {
    const def = DEFS[key];
    const canvas = document.getElementById(canvasId || def.canvas);
    if (!canvas) return;
    if (!window.Chart) { showFallback(canvas); return; }
    const id = canvasId || def.canvas;
    const labels = history.map((x) => label(x.turn));
    const datasets = def.datasets(history);

    // Only one point (the very first quarter)? Draw it anyway as a dot.
    if (history.length === 1) datasets.forEach((d) => { d.pointRadius = 3; });

    // The page was re-rendered and this is a new canvas: start a fresh chart
    if (charts[id] && charts[id].canvas !== canvas) {
      charts[id].destroy();
      delete charts[id];
    }
    if (charts[id]) {
      charts[id].data.labels = labels;
      charts[id].data.datasets.forEach((d, i) => { d.data = datasets[i].data; d.pointRadius = datasets[i].pointRadius; });
      charts[id].update();
      return;
    }
    charts[id] = new Chart(canvas, { type: def.type || 'line', data: { labels, datasets }, options: baseOptions(def.axes) });
  }

  function update(state, which = ['economy', 'wellbeing', 'budget', 'finance']) {
    // Revenue bars skip the starting snapshot (no quarter has been played yet)
    for (const key of which) {
      const hist = key === 'budget' ? state.history.slice(1).slice(-20) : state.history;
      draw(key, hist.length ? hist : state.history);
    }
  }

  // Theme changes need fresh colors, so throw the charts away and redraw
  function destroyAll() {
    for (const id of Object.keys(charts)) {
      charts[id].destroy();
      delete charts[id];
    }
  }

  Mayor.ui.charts = { update, draw, destroyAll };
})();
