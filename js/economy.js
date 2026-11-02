// economy.js — the economic simulation. Pure math: it never touches the page.
window.Mayor = window.Mayor || {};

(function () {
  const C = Mayor.config;
  const { clamp } = Mayor.util;
  const BONUS_KEYS = ['happiness', 'climate', 'gdpGrowth', 'popGrowth', 'revenue', 'expenses', 'interest',
    'education', 'healthcare', 'safety', 'infrastructure', 'parks'];

  // Adds up lasting effects from finished projects and temporary event modifiers.
  function getBonuses(state) {
    const bonus = {};
    for (const key of BONUS_KEYS) bonus[key] = 0;

    for (const p of state.projects) {
      if (p.turnsLeft > 0) continue; // still under construction
      const def = Mayor.projects.get(p.id);
      for (const [key, amount] of Object.entries(def.effects)) bonus[key] += amount;
    }
    for (const m of state.modifiers) bonus[m.key] += m.amount;
    return bonus;
  }

  // Service quality the current budget is heading toward (0–100).
  // Uses diminishing returns: doubling spending does NOT double quality.
  function serviceTarget(state, name, bonus) {
    const perCapita = state.policies.budget[name] / state.population;
    const k = C.defaultBudget[name] / C.start.population / Math.LN2; // default budget → 50 quality
    return clamp(100 * (1 - Math.exp(-perCapita / k)) + bonus[name], 0, 100);
  }

  // Debt is judged against yearly revenue. A floor of 2% of yearly GDP stops a city
  // that sets taxes to zero from being rated "bankrupt" instantly.
  function debtRatio(state, yearlyRevenue) {
    return state.debt / Math.max(yearlyRevenue, state.gdp * 4 * 0.02);
  }

  function getRating(state, yearlyRevenue) {
    const ratio = debtRatio(state, yearlyRevenue);
    const rating = C.debt.ratings.find((r) => ratio < r.max);
    return { ...rating, ratio };
  }

  // Income and spending for one quarter at the current policies.
  // The Budget tab uses this for its live preview, and simulateQuarter uses it for real.
  function projectBudget(state, bonus = getBonuses(state)) {
    const E = C.economy;
    const t = state.policies.taxes;
    const b = state.policies.budget;

    const revenue = {
      income: state.gdp * E.wageShare * (1 - state.unemployment) * t.income,
      business: state.gdp * E.profitShare * t.business,
      sales: state.gdp * E.consumptionShare * t.sales,
      other: bonus.revenue,
    };
    revenue.total = revenue.income + revenue.business + revenue.sales + revenue.other;

    const unemployed = state.population * E.laborShare * state.unemployment;
    const rating = getRating(state, revenue.total * 4);
    const upkeep = state.projects.reduce((sum, p) => {
      return p.turnsLeft > 0 ? sum : sum + Mayor.projects.get(p.id).upkeep;
    }, 0);

    const expenses = {
      education: b.education,
      healthcare: b.healthcare,
      safety: b.safety,
      infrastructure: b.infrastructure,
      parks: b.parks,
      welfare: unemployed * state.policies.welfare,
      upkeep,
      interest: state.debt * (rating.rate + bonus.interest) / 4,
      other: bonus.expenses,
    };
    expenses.total = Object.values(expenses).reduce((a, v) => a + v, 0);

    return { revenue, expenses, net: revenue.total - expenses.total, rating };
  }

  function taxBurden(taxes) {
    // What residents "feel": income and sales tax fully, business tax a little
    return taxes.income + taxes.sales + taxes.business * 0.25;
  }

  function happinessTarget(state, bonus) {
    const H = C.happiness;
    let services = 0;
    for (const [name, w] of Object.entries(H.weights)) services += state.services[name] * w;

    const welfareRelief = H.welfareRelief * Math.min(1, state.policies.welfare / H.welfareFull);
    const jobPenalty = Math.max(0, state.unemployment - H.unemploymentThreshold) * H.unemploymentFactor * (1 - welfareRelief);
    const taxPenalty = Math.max(0, taxBurden(state.policies.taxes) - H.taxThreshold) * H.taxFactor;

    return clamp(H.base + services * H.serviceScale - jobPenalty - taxPenalty + bonus.happiness, 0, 100);
  }

  function businessClimate(state, bonus) {
    const K = C.climate;
    const s = state.services;
    const value = K.base
      + (s.infrastructure - 50) * K.infrastructure
      + (s.education - 50) * K.education
      + (s.safety - 50) * K.safety
      - (state.policies.taxes.business - K.businessTaxReference) * K.businessTaxFactor
      + bonus.climate;
    return clamp(value, 0, 100);
  }

  // A small record of the city at the end of a quarter, used for charts.
  function snapshot(state, budget = projectBudget(state)) {
    return {
      turn: state.turn,
      treasury: state.treasury,
      debt: state.debt,
      gdp: state.gdp,
      population: state.population,
      unemployment: state.unemployment,
      happiness: state.happiness,
      climate: state.climate,
      revenue: budget.revenue.total,
      expenses: budget.expenses.total,
    };
  }

  // Runs one quarter. Returns a NEW state (the old one is left untouched).
  function simulateQuarter(oldState) {
    const s = Mayor.util.deepClone(oldState);
    const E = C.economy;
    const bonus = getBonuses(s);
    const prev = { gdp: s.gdp, unemployment: s.unemployment, happiness: s.happiness };

    // 1–3. Money in, money out. Shortfalls are covered by borrowing.
    const budget = projectBudget(s, bonus);
    s.treasury += budget.net;
    if (s.treasury < 0) {
      const borrowed = -s.treasury;
      s.debt += borrowed;
      s.treasury = 0;
      Mayor.state.addNews(s, 'bad', `City borrows ${Mayor.util.money(borrowed)}`,
        'The treasury ran dry, so the shortfall was covered with debt.');
    }

    // 4. Services drift toward what the budget pays for
    for (const name of Mayor.state.SERVICES) {
      const target = serviceTarget(s, name, bonus);
      s.services[name] += (target - s.services[name]) * E.serviceSmoothing;
    }

    // 5. Business climate
    s.climate = businessClimate(s, bonus);

    // 6. GDP growth
    const t = s.policies.taxes;
    const taxDrag = Math.max(0, t.income + t.sales - E.taxDragThreshold) * E.taxDragFactor;
    const noise = Mayor.random.range(s, -E.noise, E.noise);
    const growth = clamp(
      E.baseGrowth
        + (s.climate - 50) * E.climateGrowth
        + (s.services.education - 50) * E.educationGrowth
        - taxDrag + bonus.gdpGrowth + noise,
      E.growthMin, E.growthMax);

    // 9. Population moves toward happy cities with jobs
    const popGrowth = clamp(
      E.naturalPopGrowth
        + (s.happiness - 50) * E.happinessMigration
        + (E.targetUnemployment - s.unemployment) * E.jobsMigration
        + bonus.popGrowth,
      -E.popGrowthLimit, E.popGrowthLimit);
    s.population *= 1 + popGrowth;
    s.gdp *= (1 + growth) * (1 + popGrowth * E.popGdpLink);

    // 7. Jobs and unemployment. The economy can't employ more people than live here.
    s.productivity *= 1 + E.productivityGrowth + (s.services.education - 50) * E.educationProductivity;
    const laborForce = s.population * E.laborShare;
    const maxGdp = laborForce * (1 - E.minUnemployment) * s.productivity;
    if (s.gdp > maxGdp) s.gdp = maxGdp;
    const jobs = s.gdp / s.productivity;
    s.unemployment = clamp(1 - jobs / laborForce, E.minUnemployment, E.maxUnemployment);

    // 8. Happiness
    const target = happinessTarget(s, bonus);
    s.happiness += (target - s.happiness) * C.happiness.smoothing;

    // 10. Bookkeeping
    s.modifiers = s.modifiers
      .map((m) => ({ ...m, turnsLeft: m.turnsLeft - 1 }))
      .filter((m) => m.turnsLeft > 0);
    Mayor.projects.tick(s);

    s.turn += 1;
    const endBudget = projectBudget(s);
    s.creditRating = endBudget.rating.grade;
    // Record what actually came in and went out during this quarter
    s.history.push({ ...snapshot(s, endBudget), revenue: budget.revenue.total, expenses: budget.expenses.total });
    s.lowHappinessStreak = s.happiness < C.lose.happinessFloor ? s.lowHappinessStreak + 1 : 0;

    writeHeadlines(s, prev, growth);
    return s;
  }

  function writeHeadlines(s, prev, growth) {
    const { pct } = Mayor.util;
    const add = Mayor.state.addNews;
    if (growth > 0.015) add(s, 'good', 'Economy booming', `GDP grew ${pct(growth)} this quarter.`);
    else if (growth < 0) add(s, 'bad', 'Economy shrinks', `GDP fell ${pct(-growth)} this quarter.`);
    if (s.unemployment >= 0.10 && prev.unemployment < 0.10) add(s, 'bad', 'Unemployment hits double digits', `${pct(s.unemployment)} of workers have no job.`);
    if (s.unemployment < 0.04 && prev.unemployment >= 0.04) add(s, 'good', 'Near full employment', 'Businesses are competing for workers.');
    if (s.happiness < 35 && prev.happiness >= 35) add(s, 'bad', 'Protests at City Hall', 'Residents are unhappy with how the city is run.');
    if (s.happiness >= 75 && prev.happiness < 75) add(s, 'good', 'Approval rating soars', 'Residents love living here.');
  }

  // Returns the new status, or null if the game continues.
  function checkGameOver(state) {
    if (projectBudget(state).rating.ratio >= C.debt.bankruptcyRatio) {
      return { status: 'lost', reason: 'bankrupt' };
    }
    if (state.lowHappinessStreak >= C.lose.happinessStreak) {
      return { status: 'lost', reason: 'recalled' };
    }
    if (state.turn >= C.TOTAL_TURNS) return { status: 'finished', reason: null };
    return null;
  }

  Mayor.economy = {
    getBonuses, serviceTarget, debtRatio, getRating, projectBudget, taxBurden,
    happinessTarget, businessClimate, snapshot, simulateQuarter, checkGameOver,
  };
})();
