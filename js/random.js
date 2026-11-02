// random.js — a seeded random number generator.
// The generator's position is stored in state.rngState, so saving and loading
// a game continues the exact same sequence of "random" outcomes.
window.Mayor = window.Mayor || {};

Mayor.random = {
  newSeed() {
    return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
  },

  // Returns a number in [0, 1) and advances state.rngState (mulberry32)
  next(state) {
    state.rngState = (state.rngState + 0x6d2b79f5) >>> 0;
    let t = state.rngState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },

  range(state, min, max) {
    return min + Mayor.random.next(state) * (max - min);
  },

  chance(state, probability) {
    return Mayor.random.next(state) < probability;
  },

  // items: [{ weight, ... }] → one item, picked in proportion to its weight
  weightedPick(state, items) {
    const total = items.reduce((sum, item) => sum + item.weight, 0);
    if (total <= 0) return null;
    let roll = Mayor.random.next(state) * total;
    for (const item of items) {
      roll -= item.weight;
      if (roll < 0) return item;
    }
    return items[items.length - 1];
  },
};
