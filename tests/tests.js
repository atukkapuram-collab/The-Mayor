// tests.js — checks the game engine. Open tests/test.html in a browser to run them.
window.Mayor = window.Mayor || {};

Mayor.runTests = function () {
  const results = [];
  function test(name, fn) {
    try {
      fn();
      results.push({ name, ok: true });
    } catch (err) {
      results.push({ name, ok: false, error: err.message });
    }
  }
  function assert(cond, message) {
    if (!cond) throw new Error(message || 'Assertion failed');
  }
  function near(a, b, tolerance, message) {
    assert(Math.abs(a - b) <= tolerance, `${message}: expected ${b}, got ${a}`);
  }

  const C = Mayor.config;
  const newGame = (seed = 42) => Mayor.state.createNewGame('Testville', seed);

  test('A new game starts with the configured values', () => {
    const s = newGame();
    assert(s.turn === 0 && s.status === 'playing', 'turn 0, playing');
    assert(s.treasury === C.start.treasury, 'treasury');
    assert(s.history.length === 1, 'one history entry');
  });

  test('Revenue matches the formulas by hand', () => {
    const s = newGame();
    const b = Mayor.economy.projectBudget(s);
    const E = C.economy;
    near(b.revenue.income, s.gdp * E.wageShare * (1 - s.unemployment) * 0.04, 1, 'income tax');
    near(b.revenue.business, s.gdp * E.profitShare * 0.06, 1, 'business tax');
    near(b.revenue.sales, s.gdp * E.consumptionShare * 0.03, 1, 'sales tax');
    near(b.net, b.revenue.total - b.expenses.total, 1, 'net');
  });

  test('Default budgets give 50 service quality', () => {
    const s = newGame();
    const bonus = Mayor.economy.getBonuses(s);
    for (const name of Mayor.state.SERVICES) near(Mayor.economy.serviceTarget(s, name, bonus), 50, 0.01, name);
  });

  test('Spending more raises service quality, with diminishing returns', () => {
    const s = newGame();
    const bonus = Mayor.economy.getBonuses(s);
    s.policies.budget.education = 30e6;
    const double = Mayor.economy.serviceTarget(s, 'education', bonus);
    s.policies.budget.education = 45e6;
    const triple = Mayor.economy.serviceTarget(s, 'education', bonus);
    assert(double > 50 && triple > double, 'more money, more quality');
    assert(triple - double < double - 50, 'each extra dollar does less');
  });

  test('Simulating a quarter does not change the old state', () => {
    const s = newGame();
    const copy = JSON.stringify(s);
    const next = Mayor.economy.simulateQuarter(s);
    assert(JSON.stringify(s) === copy, 'old state untouched');
    assert(next.turn === 1 && next.history.length === 2, 'new state advanced');
  });

  test('The same seed gives the same game', () => {
    let a = newGame(7), b = newGame(7);
    for (let i = 0; i < 20; i++) { a = Mayor.game.endTurn(a); b = Mayor.game.endTurn(b); if (a.pendingEvent) { Mayor.events.resolveChoice(a, 0); Mayor.events.resolveChoice(b, 0); } }
    assert(JSON.stringify(a) === JSON.stringify(b), 'identical states');
  });

  test('Stats stay in range over 1,000 random quarters', () => {
    for (let g = 0; g < 25; g++) {
      let s = newGame(1000 + g);
      // Random policies each game
      const r = () => Mayor.random.next(s);
      s.policies.taxes = { income: r() * 0.1, business: r() * 0.15, sales: r() * 0.1 };
      for (const k of Object.keys(s.policies.budget)) s.policies.budget[k] = r() * C.budgetLimits[k].max;
      for (let i = 0; i < 40 && s.status === 'playing'; i++) {
        s = Mayor.game.endTurn(s);
        if (s.pendingEvent) Mayor.events.resolveChoice(s, i % 2);
        assert(Number.isFinite(s.gdp) && s.gdp > 0, 'gdp positive');
        assert(s.population > 0, 'population positive');
        assert(s.unemployment >= C.economy.minUnemployment && s.unemployment <= C.economy.maxUnemployment, 'unemployment in range');
        assert(s.happiness >= 0 && s.happiness <= 100, 'happiness 0-100');
        assert(s.treasury >= 0 && s.debt >= 0, 'treasury and debt never negative');
        for (const v of Object.values(s.services)) assert(v >= 0 && v <= 100, 'service 0-100');
      }
    }
  });

  test('Running out of money borrows instead of going negative', () => {
    const s = newGame();
    s.policies.taxes = { income: 0, business: 0, sales: 0 };
    const next = Mayor.economy.simulateQuarter(s);
    assert(next.treasury === 0 || next.debt === 0, 'either cash or debt');
    let x = next;
    for (let i = 0; i < 3; i++) x = Mayor.economy.simulateQuarter(x);
    assert(x.debt > 0 && x.treasury === 0, 'city borrowed');
  });

  test('Huge debt bankrupts the city', () => {
    const s = newGame();
    s.debt = 5e9;
    const over = Mayor.economy.checkGameOver(s);
    assert(over && over.reason === 'bankrupt', 'bankrupt');
  });

  test('Three very unhappy quarters get the mayor recalled', () => {
    let s = newGame();
    s.happiness = 5;
    s.policies.taxes = { income: 0.10, business: 0.15, sales: 0.10 };
    for (let i = 0; i < 3; i++) s = Mayor.game.endTurn(s);
    assert(s.status === 'lost' && s.lossReason === 'recalled', `recalled (got ${s.status})`);
  });

  test('Projects cost money, take time, then apply their effects', () => {
    let s = newGame();
    s.treasury = 200e6;
    Mayor.projects.start(s, 'police');
    assert(s.treasury === 200e6 - Mayor.projects.get('police').cost, 'paid up front');
    assert(Mayor.projects.statusOf(s, 'police') === 'building', 'building');
    assert(Mayor.economy.getBonuses(s).safety === 0, 'no effect while building');
    for (let i = 0; i < 3; i++) s = Mayor.economy.simulateQuarter(s);
    assert(Mayor.projects.statusOf(s, 'police') === 'built', 'built after build time');
    assert(Mayor.economy.getBonuses(s).safety === 12, 'safety bonus applied');
    assert(!Mayor.projects.canBuild(s, 'police').ok, 'cannot build twice');
  });

  test('Tech Hub needs education 60', () => {
    const s = newGame();
    s.treasury = 500e6;
    assert(!Mayor.projects.canBuild(s, 'techhub').ok, 'locked at 50');
    s.services.education = 61;
    assert(Mayor.projects.canBuild(s, 'techhub').ok, 'unlocked at 61');
  });

  test('Choice events wait for the player and then apply', () => {
    const s = newGame();
    Mayor.events.trigger(s, Mayor.events.get('flood'));
    assert(s.pendingEvent === 'flood', 'waiting for a choice');
    assert(Mayor.game.endTurn(s) === s, 'cannot end the turn while an event waits');
    const before = s.treasury;
    Mayor.events.resolveChoice(s, 0);
    assert(s.pendingEvent === null, 'resolved');
    near(s.treasury, before - 25e6, 1, 'repair cost paid');
  });

  test('Temporary modifiers expire', () => {
    let s = newGame();
    Mayor.events.applyEffects(s, { modifiers: [{ key: 'happiness', amount: 10, turns: 2 }] }, 'test');
    s = Mayor.economy.simulateQuarter(s);
    assert(s.modifiers.length === 1, 'still active after 1');
    s = Mayor.economy.simulateQuarter(s);
    assert(s.modifiers.length === 0, 'gone after 2');
  });

  test('Save and load round-trip through JSON', () => {
    let s = newGame();
    for (let i = 0; i < 5; i++) { s = Mayor.game.endTurn(s); if (s.pendingEvent) Mayor.events.resolveChoice(s, 0); }
    const loaded = JSON.parse(JSON.stringify(s));
    const a = Mayor.game.endTurn(s);
    const b = Mayor.game.endTurn(loaded);
    assert(JSON.stringify(a) === JSON.stringify(b), 'loaded game continues identically');
  });

  test('Final score is between 0 and 1000 with a grade', () => {
    let s = newGame();
    while (s.status === 'playing') { s = Mayor.game.endTurn(s); if (s.pendingEvent) Mayor.events.resolveChoice(s, 0); }
    const r = Mayor.scoring.calculate(s);
    assert(r.total >= 0 && r.total <= 1000, `score ${r.total}`);
    assert(['S', 'A', 'B', 'C', 'D', 'F'].includes(r.grade), 'grade');
    assert(r.parts.length === 5, 'five parts');
  });

  return results;
};
