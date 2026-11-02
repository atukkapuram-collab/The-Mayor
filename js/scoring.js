// scoring.js — the final city performance score (0–1000).
window.Mayor = window.Mayor || {};

(function () {
  const { clamp } = Mayor.util;

  // Maps a value onto 0..1 between a "worst" and a "best" point
  function scale(value, worst, best) {
    return clamp((value - worst) / (best - worst), 0, 1);
  }

  function calculate(state) {
    const C = Mayor.config;
    const W = C.score.weights;
    const first = state.history[0];
    const avgHappiness = state.history.reduce((a, h) => a + h.happiness, 0) / state.history.length;
    const yearlyRevenue = Mayor.economy.projectBudget(state).revenue.total * 4;
    const netWorth = (state.treasury - state.debt) / Math.max(yearlyRevenue, state.gdp * 4 * 0.02);

    const gdpRatio = state.gdp / first.gdp;
    const popRatio = state.population / first.population;

    const parts = [
      { key: 'gdp', label: 'Economic growth', detail: `GDP ${Mayor.util.signed(Mayor.util.pct(gdpRatio - 1, 0), gdpRatio - 1)}`, value: scale(gdpRatio, 1.0, 1.7) },
      { key: 'happiness', label: 'Citizen happiness', detail: `Average ${avgHappiness.toFixed(0)} / 100`, value: scale(avgHappiness, 35, 85) },
      { key: 'fiscal', label: 'Fiscal health', detail: `Net worth ${Mayor.util.money(state.treasury - state.debt)}`, value: scale(netWorth, -1, 0.5) },
      { key: 'population', label: 'Population growth', detail: `${Mayor.util.signed(Mayor.util.pct(popRatio - 1, 0), popRatio - 1)} residents`, value: scale(popRatio, 1.0, 1.35) },
      { key: 'unemployment', label: 'Jobs', detail: `${Mayor.util.pct(state.unemployment)} unemployed`, value: scale(state.unemployment, 0.12, 0.03) },
    ];

    let total = 0;
    for (const p of parts) {
      p.weight = W[p.key];
      p.points = Math.round(p.value * p.weight * 1000);
      total += p.points;
    }

    // Losing early scales the score down by how much of the term you served
    if (state.status === 'lost') total = Math.round(total * (state.turn / C.TOTAL_TURNS) * 0.5);

    const rank = C.score.grades.find((g) => total >= g.min);
    let title = rank.title;
    if (state.lossReason === 'bankrupt') title = 'Bankrupted the City';
    if (state.lossReason === 'recalled') title = 'Recalled by Voters';

    return { total, grade: state.status === 'lost' ? 'F' : rank.grade, title, parts };
  }

  Mayor.scoring = { calculate };
})();
