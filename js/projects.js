// projects.js — big one-time investments that pay off over the years.
// Effects use the same keys as event modifiers (see economy.getBonuses) and
// apply every quarter once construction is finished.
window.Mayor = window.Mayor || {};

(function () {
  const CATALOG = [
    {
      id: 'transit', name: 'Transit Line', category: 'Infrastructure',
      description: 'A light-rail line that cuts commutes and connects neighborhoods.',
      cost: 60e6, buildTime: 6, upkeep: 1.5e6,
      effects: { infrastructure: 12, happiness: 3, climate: 3 },
    },
    {
      id: 'industrial', name: 'Industrial Park', category: 'Economy',
      description: 'Zoned land for factories and warehouses. Jobs, but also noise.',
      cost: 45e6, buildTime: 4, upkeep: 0.8e6,
      effects: { climate: 8, gdpGrowth: 0.002, happiness: -3 },
    },
    {
      id: 'techhub', name: 'Tech Hub', category: 'Economy',
      description: 'An innovation campus that attracts startups. Needs a skilled workforce.',
      cost: 80e6, buildTime: 6, upkeep: 2e6,
      effects: { gdpGrowth: 0.004, climate: 5, popGrowth: 0.001 },
      requires: { service: 'education', min: 60 },
    },
    {
      id: 'hospital', name: 'General Hospital', category: 'Health',
      description: 'A modern hospital with an emergency department.',
      cost: 50e6, buildTime: 5, upkeep: 2.5e6,
      effects: { healthcare: 15, happiness: 2 },
    },
    {
      id: 'college', name: 'Community College', category: 'Education',
      description: 'Affordable degrees and job training for residents.',
      cost: 45e6, buildTime: 5, upkeep: 2e6,
      effects: { education: 10, climate: 2 },
    },
    {
      id: 'police', name: 'Police Academy', category: 'Safety',
      description: 'Better-trained officers and community policing.',
      cost: 35e6, buildTime: 3, upkeep: 1.5e6,
      effects: { safety: 12 },
    },
    {
      id: 'stadium', name: 'Stadium', category: 'Culture',
      description: 'A 40,000-seat stadium. Brings civic pride and visitors.',
      cost: 70e6, buildTime: 5, upkeep: 1e6,
      effects: { happiness: 5, revenue: 2.5e6 },
    },
    {
      id: 'solar', name: 'Solar Farm', category: 'Infrastructure',
      description: 'Clean power for city buildings. It lowers running costs.',
      cost: 40e6, buildTime: 4, upkeep: -1.2e6,
      effects: { happiness: 2, parks: 4 },
    },
  ];

  function get(id) {
    return CATALOG.find((p) => p.id === id);
  }

  // Returns 'available' | 'building' | 'built' for a project in this city
  function statusOf(state, id) {
    const p = state.projects.find((x) => x.id === id);
    if (!p) return 'available';
    return p.turnsLeft > 0 ? 'building' : 'built';
  }

  function canBuild(state, id) {
    const def = get(id);
    if (state.status !== 'playing') return { ok: false, reason: 'The term is over' };
    if (statusOf(state, id) !== 'available') return { ok: false, reason: 'Already started' };
    if (def.requires && state.services[def.requires.service] < def.requires.min) {
      return { ok: false, reason: `Needs ${def.requires.service} quality ${def.requires.min}+` };
    }
    if (state.treasury < def.cost) return { ok: false, reason: 'Not enough money in the treasury' };
    return { ok: true, reason: '' };
  }

  // Pays the cost up front and starts construction. Mutates state.
  function start(state, id) {
    const check = canBuild(state, id);
    if (!check.ok) return check;
    const def = get(id);
    state.treasury -= def.cost;
    state.projects.push({ id, turnsLeft: def.buildTime });
    Mayor.state.addNews(state, 'info', `Construction begins: ${def.name}`,
      `Ready in ${def.buildTime} quarters. Cost ${Mayor.util.money(def.cost)}.`);
    return check;
  }

  // Called once per quarter by the economy
  function tick(state) {
    for (const p of state.projects) {
      if (p.turnsLeft <= 0) continue;
      p.turnsLeft -= 1;
      if (p.turnsLeft === 0) {
        Mayor.state.addNews(state, 'good', `${get(p.id).name} opens`, 'Its benefits start next quarter.');
      }
    }
  }

  Mayor.projects = { CATALOG, get, statusOf, canBuild, start, tick };
})();
