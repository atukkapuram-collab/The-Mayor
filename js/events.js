// events.js — random things that happen to the city.
//
// An event's effects look like:
//   { instant: { treasury, populationPct, gdpPct, <service>: points },
//     modifiers: [{ key, amount, turns }] }
// "instant" happens once. "modifiers" last for a number of quarters and use the
// same keys as project effects (happiness, climate, gdpGrowth, revenue, ...).
// effects can also be a function (state) => effects, for events that depend on the city.
window.Mayor = window.Mayor || {};

(function () {
  const DECK = [
    {
      id: 'recession', title: 'Regional Recession', category: 'Economy',
      text: 'A downturn across the region hits local businesses and hiring.',
      weight: 5, condition: (s) => s.turn >= 4,
      effects: { modifiers: [{ key: 'gdpGrowth', amount: -0.012, turns: 4 }, { key: 'climate', amount: -5, turns: 4 }] },
    },
    {
      id: 'techboom', title: 'Tech Boom', category: 'Economy',
      text: 'Tech companies are expanding and your skilled workers are in demand.',
      weight: 4, condition: (s) => s.services.education >= 55,
      effects: { modifiers: [{ key: 'gdpGrowth', amount: 0.008, turns: 4 }] },
    },
    {
      id: 'flood', title: 'Flash Flood', category: 'Disaster',
      text: 'Heavy storms flooded streets and damaged roads and bridges. How do you respond?',
      weight: 3,
      choices: [
        { label: 'Repair everything now', effects: { instant: { treasury: -25e6 } } },
        {
          label: 'Patch the worst damage',
          effects: { instant: { treasury: -5e6, infrastructure: -15 }, modifiers: [{ key: 'happiness', amount: -4, turns: 3 }] },
        },
      ],
    },
    {
      id: 'factory', title: 'Factory Wants a Tax Break', category: 'Business',
      text: 'A manufacturer will build a plant here if you cut its taxes for three years.',
      weight: 4,
      choices: [
        {
          label: 'Accept the deal',
          effects: { modifiers: [{ key: 'gdpGrowth', amount: 0.003, turns: 12 }, { key: 'revenue', amount: -2e6, turns: 12 }, { key: 'climate', amount: 4, turns: 12 }] },
        },
        { label: 'Decline', effects: { modifiers: [{ key: 'climate', amount: -2, turns: 4 }] } },
      ],
    },
    {
      id: 'grant', title: 'Federal Grant Awarded', category: 'Finance',
      text: 'The national government awarded the city an infrastructure grant.',
      weight: 4,
      effects: { instant: { treasury: 20e6 } },
    },
    {
      id: 'pandemic', title: 'Flu Outbreak', category: 'Health',
      text: 'A severe flu season fills hospitals and keeps workers at home.',
      weight: 2, condition: (s) => s.turn >= 6,
      effects: (s) => {
        const scale = s.services.healthcare >= 65 ? 0.5 : 1; // good healthcare softens the blow
        return {
          instant: { populationPct: -0.01 * scale },
          modifiers: [{ key: 'gdpGrowth', amount: -0.01 * scale, turns: 3 }, { key: 'happiness', amount: -6 * scale, turns: 3 }],
        };
      },
    },
    {
      id: 'tourism', title: 'Tourism Surge', category: 'Economy',
      text: 'A travel magazine named your city a must-visit destination.',
      weight: 4, condition: (s) => s.services.parks >= 45,
      effects: { modifiers: [{ key: 'revenue', amount: 4e6, turns: 4 }, { key: 'happiness', amount: 2, turns: 4 }] },
    },
    {
      id: 'strike', title: 'Teachers Strike', category: 'Education',
      text: 'Underpaid teachers walked out. They demand a one-time bonus.',
      weight: 5, condition: (s) => s.services.education < 45,
      choices: [
        { label: 'Pay the bonus', effects: { instant: { treasury: -12e6, education: 5 } } },
        { label: 'Wait them out', effects: { instant: { education: -10 }, modifiers: [{ key: 'happiness', amount: -5, turns: 3 }] } },
      ],
    },
    {
      id: 'scandal', title: 'Corruption Scandal', category: 'Politics',
      text: 'A city contractor was caught overbilling. Money is lost and trust is shaken.',
      weight: 2,
      effects: { instant: { treasury: -8e6 }, modifiers: [{ key: 'happiness', amount: -8, turns: 3 }] },
    },
    {
      id: 'housing', title: 'Housing Boom', category: 'Growth',
      text: 'Developers are building new neighborhoods and families are moving in.',
      weight: 3, condition: (s) => s.happiness >= 55,
      effects: { modifiers: [{ key: 'popGrowth', amount: 0.006, turns: 4 }, { key: 'gdpGrowth', amount: 0.003, turns: 4 }] },
    },
    {
      id: 'heatwave', title: 'Heatwave', category: 'Disaster',
      text: 'Record temperatures strain the power grid and emergency services.',
      weight: 3,
      effects: (s) => {
        const scale = s.services.parks >= 60 ? 0.5 : 1; // green space keeps the city cooler
        return { modifiers: [{ key: 'happiness', amount: -4 * scale, turns: 2 }, { key: 'expenses', amount: 3e6 * scale, turns: 2 }] };
      },
    },
    {
      id: 'employer', title: 'Major Employer Leaves', category: 'Business',
      text: 'A large company is moving its headquarters to a cheaper city.',
      // Much more likely when business taxes are high
      weight: 2, weightFn: (s) => 1 + Math.max(0, s.policies.taxes.business - 0.06) * 100,
      effects: { instant: { gdpPct: -0.02 }, modifiers: [{ key: 'climate', amount: -4, turns: 4 }] },
    },
    {
      id: 'festival', title: 'Summer Festival Proposal', category: 'Culture',
      text: 'Local artists propose a citywide summer festival if the city helps fund it.',
      weight: 3,
      choices: [
        { label: 'Fund the festival', effects: { instant: { treasury: -5e6 }, modifiers: [{ key: 'happiness', amount: 6, turns: 2 }, { key: 'revenue', amount: 1.5e6, turns: 2 }] } },
        { label: 'Not this year', effects: {} },
      ],
    },
    {
      id: 'bonds', title: 'Bond Market Crunch', category: 'Finance',
      text: 'Lenders are nervous. Interest on city debt jumps for a year.',
      weight: 3, condition: (s) => s.debt > 0,
      effects: { modifiers: [{ key: 'interest', amount: 0.02, turns: 4 }] },
    },
    {
      id: 'startups', title: 'Startup Wave', category: 'Economy',
      text: 'Founders are choosing your city for its friendly business climate.',
      weight: 3, condition: (s) => s.climate >= 55,
      effects: { modifiers: [{ key: 'climate', amount: 5, turns: 6 }, { key: 'gdpGrowth', amount: 0.004, turns: 4 }] },
    },
    {
      id: 'crime', title: 'Crime Wave', category: 'Safety',
      text: 'Break-ins and car thefts are rising. Some families are leaving.',
      weight: 4, condition: (s) => s.services.safety < 40,
      effects: { modifiers: [{ key: 'happiness', amount: -6, turns: 4 }, { key: 'popGrowth', amount: -0.003, turns: 4 }] },
    },
  ];

  function get(id) {
    return DECK.find((e) => e.id === id);
  }

  function resolveEffects(effects, state) {
    return typeof effects === 'function' ? effects(state) : effects || {};
  }

  // Picks this quarter's event, or null. Uses the seeded RNG.
  function roll(state) {
    const C = Mayor.config.events;
    if (state.turn === 0 || !Mayor.random.chance(state, C.chance)) return null;
    const options = DECK
      .filter((e) => !e.condition || e.condition(state))
      .filter((e) => {
        const last = state.eventCooldowns[e.id];
        return last === undefined || state.turn - last >= C.cooldown;
      })
      .map((e) => ({ event: e, weight: e.weight * (e.weightFn ? e.weightFn(state) : 1) }));
    const picked = Mayor.random.weightedPick(state, options);
    return picked ? picked.event : null;
  }

  // Applies effects to the state (mutates it).
  function applyEffects(state, effects, source) {
    const inst = effects.instant || {};
    for (const [key, value] of Object.entries(inst)) {
      if (key === 'treasury') {
        state.treasury += value;
        if (state.treasury < 0) { state.debt += -state.treasury; state.treasury = 0; }
      } else if (key === 'populationPct') {
        state.population *= 1 + value;
      } else if (key === 'gdpPct') {
        state.gdp *= 1 + value;
      } else if (key in state.services) {
        state.services[key] = Mayor.util.clamp(state.services[key] + value, 0, 100);
      }
    }
    for (const m of effects.modifiers || []) {
      state.modifiers.push({ key: m.key, amount: m.amount, turnsLeft: m.turns, source });
    }
  }

  // An event without choices happens right away. One with choices waits for the player.
  function trigger(state, event) {
    state.eventCooldowns[event.id] = state.turn;
    if (event.choices) {
      state.pendingEvent = event.id;
      return;
    }
    applyEffects(state, resolveEffects(event.effects, state), event.title);
    state.eventsSeen.push({ id: event.id, turn: state.turn, choice: null });
    Mayor.state.addNews(state, 'event', event.title, event.text);
  }

  function resolveChoice(state, choiceIndex) {
    const event = get(state.pendingEvent);
    if (!event) { state.pendingEvent = null; return; }
    const choice = event.choices[choiceIndex];
    applyEffects(state, resolveEffects(choice.effects, state), event.title);
    state.eventsSeen.push({ id: event.id, turn: state.turn, choice: choiceIndex });
    state.pendingEvent = null;
    Mayor.state.addNews(state, 'event', event.title, `You chose: ${choice.label}.`);
  }

  const LABELS = {
    happiness: 'Happiness', climate: 'Business climate', gdpGrowth: 'GDP growth', popGrowth: 'Population growth',
    revenue: 'Revenue', expenses: 'Costs', interest: 'Interest rate', education: 'Education', healthcare: 'Healthcare',
    safety: 'Safety', infrastructure: 'Infrastructure', parks: 'Parks', treasury: 'Treasury',
    populationPct: 'Population', gdpPct: 'GDP',
  };
  // Is a positive number good for the city?
  const BAD_WHEN_UP = new Set(['expenses', 'interest']);

  function formatAmount(key, v) {
    const { money, pct, signed } = Mayor.util;
    if (['treasury', 'revenue', 'expenses'].includes(key)) return signed(money(v), v);
    if (['gdpGrowth', 'popGrowth', 'interest'].includes(key)) return signed(pct(v), v) + (key === 'interest' ? '' : '/qtr');
    if (['populationPct', 'gdpPct'].includes(key)) return signed(pct(v), v);
    return signed(String(Math.round(v * 10) / 10), v);
  }

  // Turns effects into readable chips: [{ text, tone }]
  function describe(effects, state) {
    const e = resolveEffects(effects, state);
    const out = [];
    for (const [key, v] of Object.entries(e.instant || {})) {
      const good = BAD_WHEN_UP.has(key) ? v < 0 : v > 0;
      out.push({ text: `${LABELS[key]} ${formatAmount(key, v)}`, tone: good ? 'good' : 'bad' });
    }
    for (const m of e.modifiers || []) {
      const good = BAD_WHEN_UP.has(m.key) ? m.amount < 0 : m.amount > 0;
      out.push({ text: `${LABELS[m.key]} ${formatAmount(m.key, m.amount)} for ${m.turns} qtrs`, tone: good ? 'good' : 'bad' });
    }
    if (!out.length) out.push({ text: 'No effect', tone: 'neutral' });
    return out;
  }

  Mayor.events = { DECK, LABELS, get, roll, applyEffects, trigger, resolveChoice, describe, formatAmount, BAD_WHEN_UP };
})();
