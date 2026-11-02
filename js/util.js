// util.js — small helpers for math and number formatting.
window.Mayor = window.Mayor || {};

Mayor.util = {
  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  },

  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  // 1234567 → "$1.23M"
  money(n, digits = 1) {
    const sign = n < 0 ? '−' : '';
    const a = Math.abs(n);
    if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(digits + 1)}B`;
    if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(digits)}M`;
    if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
    return `${sign}$${a.toFixed(0)}`;
  },

  // 0.0534 → "5.3%"
  pct(n, digits = 1) {
    return `${(n * 100).toFixed(digits)}%`;
  },

  int(n) {
    return Math.round(n).toLocaleString('en-US');
  },

  // Adds a + sign to positive numbers
  signed(text, n) {
    return n > 0 ? `+${text}` : text;
  },

  escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // turn 0 → { year: 1, quarter: 1 }
  dateOf(turn) {
    return { year: Math.floor(turn / 4) + 1, quarter: (turn % 4) + 1 };
  },

  dateLabel(turn) {
    const d = Mayor.util.dateOf(turn);
    return `Year ${d.year} · Q${d.quarter}`;
  },
};
