// ui/news.js — the City News feed and the Reports ledger.
window.Mayor = window.Mayor || {};
Mayor.ui = Mayor.ui || {};

(function () {
  const U = Mayor.util;

  function renderNews(state) {
    const latestTurn = state.news.length ? state.news[0].turn : -1;
    document.getElementById('news-list').innerHTML = state.news.map((n) => `
      <li class="news-item ${n.turn === latestTurn && state.turn > 0 ? 'is-new' : ''}">
        <span class="dot dot--${n.tone}"></span>
        <div>
          <div class="news-title">${U.escapeHtml(n.title)}</div>
          ${n.text ? `<div class="news-text">${U.escapeHtml(n.text)}</div>` : ''}
          <div class="news-meta">${U.dateLabel(n.turn)}</div>
        </div>
      </li>`).join('');
  }

  function renderLedger(state) {
    const rows = state.history.slice(1).slice(-12).reverse();
    const table = document.getElementById('ledger');
    if (!rows.length) {
      table.innerHTML = '<tr><td class="muted">Play a quarter to see your first report.</td></tr>';
      return;
    }
    // A snapshot is taken at the end of a quarter, so turn N describes the quarter that just ended
    table.innerHTML = `
      <thead><tr><th>Quarter</th><th>Revenue</th><th>Spending</th><th>Net</th><th>Treasury</th><th>Debt</th><th>Happiness</th></tr></thead>
      <tbody>${rows.map((h) => {
        const net = h.revenue - h.expenses;
        return `<tr>
          <td>${U.dateLabel(h.turn - 1)}</td>
          <td>${U.money(h.revenue)}</td>
          <td>${U.money(h.expenses)}</td>
          <td class="${net >= 0 ? 'pos' : 'neg'}">${U.signed(U.money(net), net)}</td>
          <td>${U.money(h.treasury)}</td>
          <td>${U.money(h.debt)}</td>
          <td>${h.happiness.toFixed(0)}</td>
        </tr>`;
      }).join('')}</tbody>`;
  }

  Mayor.ui.news = { renderNews, renderLedger };
})();
