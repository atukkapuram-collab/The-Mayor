// strategies.js — scripted "players" used by the balance simulator.
// Each one sets policies at the start and can act every turn.
window.Mayor = window.Mayor || {};

Mayor.strategies = [
  {
    name: 'Do nothing',
    setup() {},
  },
  {
    name: 'Max taxes',
    setup(s) {
      s.policies.taxes = { income: 0.10, business: 0.15, sales: 0.10 };
    },
  },
  {
    name: 'Zero taxes',
    setup(s) {
      s.policies.taxes = { income: 0, business: 0, sales: 0 };
    },
  },
  {
    name: 'Max spend',
    setup(s) {
      for (const [k, lim] of Object.entries(Mayor.config.budgetLimits)) s.policies.budget[k] = lim.max;
    },
  },
  {
    name: 'Austerity',
    setup(s) {
      for (const k of Object.keys(s.policies.budget)) s.policies.budget[k] = 2e6;
      s.policies.welfare = 0;
    },
  },
  {
    // A sensible player: scales budgets with population, keeps a balanced budget,
    // repays debt and builds projects when it can afford them.
    name: 'Balanced',
    setup(s) {
      s.policies.taxes = { income: 0.05, business: 0.05, sales: 0.035 };
      s.policies.budget = { education: 20e6, healthcare: 15e6, safety: 12e6, infrastructure: 13e6, parks: 5e6 };
    },
    eachTurn(s) {
      const growth = s.population / s.history[0].population;
      s.policies.budget = { education: 20e6 * growth, healthcare: 15e6 * growth, safety: 12e6 * growth, infrastructure: 13e6 * growth, parks: 5e6 * growth };
      const order = ['college', 'police', 'techhub', 'transit', 'hospital', 'solar', 'industrial', 'stadium'];
      for (const id of order) {
        const def = Mayor.projects.get(id);
        if (Mayor.projects.canBuild(s, id).ok && s.treasury - def.cost > 25e6) Mayor.projects.start(s, id);
      }
      const net = Mayor.economy.projectBudget(s).net;
      if (net < 0) s.policies.taxes.income = Math.min(0.08, s.policies.taxes.income + 0.005);
      else if (net > 12e6) s.policies.taxes.income = Math.max(0.03, s.policies.taxes.income - 0.005);
      if (s.debt > 0) Mayor.game.repayDebt(s, s.treasury - 20e6);
    },
  },
];
