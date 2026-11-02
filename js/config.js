// config.js — every tuning number in the game lives here.
// Want the game easier or harder? Change values in this file and nothing else.
window.Mayor = window.Mayor || {};

Mayor.config = {
  SAVE_VERSION: 1,
  TOTAL_TURNS: 40, // 10 years × 4 quarters

  // Where every new city starts
  start: {
    treasury: 50e6,
    population: 100000,
    gdp: 1.25e9, // per quarter (≈ $5B a year)
    unemployment: 0.06,
    happiness: 60,
    serviceQuality: 50,
  },

  // Default policies (tax rates are fractions: 0.04 = 4%)
  defaultTaxes: { income: 0.04, business: 0.06, sales: 0.03 },
  defaultBudget: { education: 15e6, healthcare: 12e6, safety: 10e6, infrastructure: 10e6, parks: 4e6 },
  defaultWelfare: 2500, // $ paid per unemployed resident per quarter

  // Slider ranges
  taxLimits: {
    income: { min: 0, max: 0.10, step: 0.005 },
    business: { min: 0, max: 0.15, step: 0.005 },
    sales: { min: 0, max: 0.10, step: 0.005 },
  },
  budgetLimits: {
    education: { min: 0, max: 40e6 },
    healthcare: { min: 0, max: 35e6 },
    safety: { min: 0, max: 30e6 },
    infrastructure: { min: 0, max: 30e6 },
    parks: { min: 0, max: 15e6 },
  },
  budgetStep: 0.5e6,
  welfareLimits: { min: 0, max: 6000, step: 100 },

  economy: {
    wageShare: 0.60,        // share of GDP paid as wages (income tax base)
    profitShare: 0.20,      // share of GDP that is business profit (business tax base)
    consumptionShare: 0.45, // share of GDP spent in shops (sales tax base)
    serviceSmoothing: 0.25, // how fast service quality moves toward its target each quarter
    baseGrowth: 0.005,      // 0.5% GDP growth per quarter in a neutral city
    climateGrowth: 0.0004,  // extra growth per point of business climate above 50
    educationGrowth: 0.0001,
    taxDragThreshold: 0.07, // income + sales tax above this slows the economy
    taxDragFactor: 0.05,
    noise: 0.003,           // random ± wobble in growth each quarter
    growthMin: -0.05,
    growthMax: 0.04,
    popGdpLink: 0.8,        // new residents add this much of their share to GDP
    laborShare: 0.5,        // fraction of residents in the labor force
    minUnemployment: 0.02,
    maxUnemployment: 0.35,
    productivityGrowth: 0.003,
    educationProductivity: 0.00005,
    naturalPopGrowth: 0.002,
    happinessMigration: 0.0002,
    jobsMigration: 0.02,
    targetUnemployment: 0.06,
    popGrowthLimit: 0.03,
  },

  happiness: {
    weights: { healthcare: 0.25, safety: 0.25, education: 0.20, parks: 0.15, infrastructure: 0.15 },
    serviceScale: 0.7,
    base: 30,
    unemploymentThreshold: 0.05,
    unemploymentFactor: 300,
    welfareRelief: 0.5,  // max share of the unemployment penalty that welfare removes
    welfareFull: 5000,   // benefit level that gives the full relief
    taxThreshold: 0.08,  // felt tax burden above this makes residents unhappy
    taxFactor: 250,
    smoothing: 0.3,
  },

  climate: {
    base: 50,
    infrastructure: 0.3,
    education: 0.2,
    safety: 0.1,
    businessTaxReference: 0.06,
    businessTaxFactor: 400,
  },

  // Credit rating is based on debt ÷ yearly city revenue
  debt: {
    ratings: [
      { grade: 'AAA', max: 0.25, rate: 0.02 },
      { grade: 'AA', max: 0.5, rate: 0.025 },
      { grade: 'A', max: 1.0, rate: 0.03 },
      { grade: 'BBB', max: 1.5, rate: 0.04 },
      { grade: 'BB', max: 2.0, rate: 0.06 },
      { grade: 'B', max: 2.5, rate: 0.08 },
      { grade: 'CCC', max: 3.0, rate: 0.12 },
      { grade: 'D', max: Infinity, rate: 0.18 },
    ],
    bankruptcyRatio: 3.0,
  },

  events: { chance: 0.3, cooldown: 8 },

  lose: { happinessFloor: 20, happinessStreak: 3 },

  score: {
    weights: { gdp: 0.25, happiness: 0.25, fiscal: 0.20, population: 0.15, unemployment: 0.15 },
    grades: [
      { grade: 'S', min: 850, title: 'Legendary Mayor' },
      { grade: 'A', min: 700, title: 'Visionary Leader' },
      { grade: 'B', min: 550, title: 'Steady Hand' },
      { grade: 'C', min: 400, title: 'Caretaker Mayor' },
      { grade: 'D', min: 250, title: 'Struggling Administrator' },
      { grade: 'F', min: 0, title: 'One-Term Wonder' },
    ],
  },
};
