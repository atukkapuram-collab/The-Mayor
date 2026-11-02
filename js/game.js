// game.js — the turn flow, tying the engine pieces together. Still no page code.
window.Mayor = window.Mayor || {};

(function () {
  // Plays one quarter: economy → game-over check → random event. Returns the new state.
  function endTurn(state) {
    if (state.status !== 'playing' || state.pendingEvent) return state;
    const s = Mayor.economy.simulateQuarter(state);

    const over = Mayor.economy.checkGameOver(s);
    if (over) {
      s.status = over.status;
      s.lossReason = over.reason;
      if (over.reason === 'bankrupt') Mayor.state.addNews(s, 'bad', 'City declares bankruptcy', 'The state has taken over city finances.');
      else if (over.reason === 'recalled') Mayor.state.addNews(s, 'bad', 'Mayor recalled', 'Voters removed you from office.');
      else Mayor.state.addNews(s, 'good', 'Your term is complete', 'Ten years in office. Time to see how you did.');
      return s;
    }

    const event = Mayor.events.roll(s);
    if (event) Mayor.events.trigger(s, event);
    return s;
  }

  function repayDebt(state, amount) {
    const pay = Math.min(amount, state.debt, state.treasury);
    if (pay <= 0) return 0;
    state.treasury -= pay;
    state.debt -= pay;
    if (state.debt < 1) state.debt = 0;
    Mayor.state.addNews(state, 'good', `Repaid ${Mayor.util.money(pay)} of debt`, '');
    return pay;
  }

  // Up to 3 plain-language tips for beginners, most urgent first
  function getAdvice(state) {
    const { money, pct } = Mayor.util;
    const budget = Mayor.economy.projectBudget(state);
    const tips = [];

    if (budget.net < 0) {
      const quarters = Math.floor(state.treasury / -budget.net);
      tips.push({ tone: 'bad', text: `You're losing ${money(-budget.net)} per quarter. ${quarters < 4 ? `The treasury runs out in about ${quarters} quarter${quarters === 1 ? '' : 's'}, then the city borrows.` : 'Raise taxes or trim spending before reserves run out.'}` });
    }
    if (state.debt > 0 && state.treasury > 20e6) {
      tips.push({ tone: 'info', text: `You hold ${money(state.debt)} in debt at ${pct(budget.rating.rate)}. Repaying some on the Budget tab saves interest.` });
    }
    if (state.unemployment > 0.08) {
      tips.push({ tone: 'bad', text: 'Unemployment is high. A lower business tax, better infrastructure or an Industrial Park creates jobs.' });
    }
    if (state.happiness < 45) {
      tips.push({ tone: 'bad', text: 'Residents are unhappy. Healthcare and safety matter most to them, and high income or sales taxes hurt.' });
    }
    if (state.services.education < 60 && Mayor.projects.statusOf(state, 'techhub') === 'available') {
      tips.push({ tone: 'info', text: 'Raise education quality to 60 to unlock the Tech Hub, the strongest growth project.' });
    }
    if (state.treasury > 90e6 && state.projects.length < Mayor.projects.CATALOG.length) {
      tips.push({ tone: 'good', text: `You have ${money(state.treasury)} saved. Projects turn savings into long-term growth.` });
    }
    if (!tips.length) tips.push({ tone: 'good', text: 'The city is in good shape. Keep an eye on the budget as the population grows.' });
    return tips.slice(0, 3);
  }

  Mayor.game = { endTurn, repayDebt, getAdvice };
})();
