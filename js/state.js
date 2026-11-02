// state.js — creates the game state object.
// The whole game is one plain object, so it can be saved as JSON.
window.Mayor = window.Mayor || {};

Mayor.state = {
  SERVICES: ['education', 'healthcare', 'safety', 'infrastructure', 'parks'],

  createNewGame(cityName, seed) {
    const C = Mayor.config;
    const S = C.start;
    const startSeed = seed === undefined ? Mayor.random.newSeed() : seed >>> 0;

    const services = {};
    for (const name of Mayor.state.SERVICES) services[name] = S.serviceQuality;

    const employed = S.population * C.economy.laborShare * (1 - S.unemployment);

    const state = {
      version: C.SAVE_VERSION,
      cityName: (cityName || 'New Haven').trim().slice(0, 40) || 'New Haven',
      seed: startSeed,
      rngState: startSeed,
      turn: 0,
      treasury: S.treasury,
      debt: 0,
      creditRating: 'AAA',
      population: S.population,
      gdp: S.gdp,
      productivity: S.gdp / employed, // GDP produced per job per quarter
      unemployment: S.unemployment,
      happiness: S.happiness,
      climate: C.climate.base,
      services,
      policies: {
        taxes: { ...C.defaultTaxes },
        budget: { ...C.defaultBudget },
        welfare: C.defaultWelfare,
      },
      projects: [],        // [{ id, turnsLeft }]
      modifiers: [],       // [{ key, amount, turnsLeft, source }]
      eventCooldowns: {},  // eventId → turn it last happened
      eventsSeen: [],      // [{ id, turn, choice }]
      pendingEvent: null,  // id of an event waiting for the player's choice
      history: [],
      news: [],
      status: 'playing',   // 'playing' | 'finished' | 'lost'
      lossReason: null,
      lowHappinessStreak: 0,
    };

    state.history.push(Mayor.economy.snapshot(state));
    Mayor.state.addNews(state, 'info', `Welcome, Mayor of ${state.cityName}`,
      'Your 10-year term begins. Set taxes and budgets, then end the quarter.');
    return state;
  },

  // tone: 'good' | 'bad' | 'info' | 'event'
  addNews(state, tone, title, text = '') {
    state.news.unshift({ turn: state.turn, tone, title, text });
    if (state.news.length > 60) state.news.length = 60;
  },
};
