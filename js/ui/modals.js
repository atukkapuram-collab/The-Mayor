// ui/modals.js — pop-up dialogs (events, year-end summary, tutorial, confirm) and toasts.
// Modals are queued so only one shows at a time.
window.Mayor = window.Mayor || {};
Mayor.ui = Mayor.ui || {};

(function () {
  const U = Mayor.util;
  const queue = [];
  let open = null;

  // opts: { eyebrow, title, body (html), actions: [{ label, cls, onClick }], dismissible, onRender }
  function show(opts) {
    queue.push(opts);
    if (!open) next();
  }

  function next() {
    const opts = queue.shift();
    if (!opts) { open = null; return; }
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          ${opts.eyebrow ? `<p class="eyebrow">${opts.eyebrow}</p>` : ''}
          <h2 id="modal-title">${opts.title}</h2>
          <div class="modal-body">${opts.body || ''}</div>
          ${opts.actions && opts.actions.length ? `<div class="modal-actions">${opts.actions.map((a, i) =>
            `<button class="btn ${a.cls || ''}" data-action="${i}">${a.label}</button>`).join('')}</div>` : ''}
        </div>
      </div>`;
    open = { opts, root };

    root.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = opts.actions[Number(btn.dataset.action)];
        if (action.onClick && action.onClick() === false) return; // returning false keeps it open
        close();
      });
    });
    if (opts.dismissible !== false) {
      root.querySelector('.modal-backdrop').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) close();
      });
    }
    if (opts.onRender) opts.onRender(root.querySelector('.modal'), close);
    const focusable = root.querySelector('.choice, .modal-actions .btn--accent, .modal-actions .btn');
    if (focusable) focusable.focus();
  }

  function close() {
    document.getElementById('modal-root').innerHTML = '';
    open = null;
    next();
  }

  function isOpen() {
    return !!open;
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open && open.opts.dismissible !== false) close();
  });

  // ---------- Specific dialogs ----------

  function chipList(chips) {
    return `<div class="effect-chips">${chips.map((c) => `<span class="chip chip--${c.tone}">${c.text}</span>`).join('')}</div>`;
  }

  // A choice event. It can't be dismissed: the player must decide.
  function eventChoice(state, onChoose) {
    const ev = Mayor.events.get(state.pendingEvent);
    show({
      eyebrow: `${ev.category} · ${U.dateLabel(state.turn)}`,
      title: ev.title,
      dismissible: false,
      body: `<p>${ev.text}</p>
        <div class="choices">${ev.choices.map((c, i) => `
          <button class="choice" data-choice="${i}">
            <span class="choice-label">${c.label}</span>
            ${chipList(Mayor.events.describe(c.effects, state))}
          </button>`).join('')}
        </div>`,
      onRender(modal, closeModal) {
        modal.querySelectorAll('[data-choice]').forEach((btn) => {
          btn.addEventListener('click', () => {
            closeModal();
            onChoose(Number(btn.dataset.choice));
          });
        });
      },
    });
  }

  // An event that just happened (no choice)
  function eventNotice(state, eventId) {
    const ev = Mayor.events.get(eventId);
    const entry = state.eventsSeen[state.eventsSeen.length - 1];
    show({
      eyebrow: `${ev.category} · ${U.dateLabel(entry.turn)}`,
      title: ev.title,
      body: `<p>${ev.text}</p>${chipList(Mayor.events.describe(ev.effects, state))}`,
      actions: [{ label: 'Understood', cls: 'btn--accent' }],
    });
  }

  function yearEnd(state) {
    const h = state.history;
    const now = h[h.length - 1];
    const then = h[Math.max(0, h.length - 5)];
    const year = U.dateOf(state.turn - 1).year;
    const yearRevenue = h.slice(-4).reduce((a, x) => a + x.revenue, 0);
    const yearSpend = h.slice(-4).reduce((a, x) => a + x.expenses, 0);
    const stat = (label, value, delta, good) => `
      <div class="summary-stat">
        <div class="label">${label}</div>
        <div class="value">${value}</div>
        <div class="delta ${good === null ? 'delta--flat' : good ? 'delta--good' : 'delta--bad'}">${delta}</div>
      </div>`;
    const gdpChange = now.gdp / then.gdp - 1;
    const popChange = now.population / then.population - 1;
    const uDiff = now.unemployment - then.unemployment;
    const hDiff = now.happiness - then.happiness;
    const net = yearRevenue - yearSpend;

    show({
      eyebrow: 'Annual report',
      title: `Year ${year} in review`,
      body: `
        <div class="summary-grid">
          ${stat('GDP', U.money(now.gdp * 4), `${U.signed(U.pct(gdpChange), gdpChange)} this year`, gdpChange >= 0)}
          ${stat('Population', U.int(now.population), `${U.signed(U.pct(popChange), popChange)} this year`, popChange >= 0)}
          ${stat('Unemployment', U.pct(now.unemployment), `${uDiff > 0 ? '+' : ''}${(uDiff * 100).toFixed(1)} pts`, uDiff <= 0)}
          ${stat('Happiness', now.happiness.toFixed(0), `${hDiff > 0 ? '+' : ''}${hDiff.toFixed(1)}`, hDiff >= 0)}
          ${stat('Budget result', U.signed(U.money(net), net), `${U.money(yearRevenue)} in · ${U.money(yearSpend)} out`, net >= 0)}
          ${stat('Debt', U.money(now.debt), `Credit rating ${state.creditRating}`, now.debt <= then.debt)}
        </div>
        <p>${10 - year > 0 ? `${10 - year} year${10 - year === 1 ? '' : 's'} left in your term.` : 'This was your final year.'}</p>`,
      actions: [{ label: 'Continue', cls: 'btn--accent' }],
    });
  }

  function confirm({ title, body, confirmLabel, danger, onConfirm }) {
    show({
      title,
      body: `<p>${body}</p>`,
      actions: [
        { label: 'Cancel', cls: 'btn--ghost' },
        { label: confirmLabel, cls: danger ? 'btn--primary' : 'btn--accent', onClick: onConfirm },
      ],
    });
  }

  const TUTORIAL = [
    { title: 'Welcome to City Hall', body: 'You have <b>10 years (40 quarters)</b> to grow your city. Each turn is one quarter. Set your policies, then press <b>End Quarter</b> to see what happens.' },
    { title: 'Balance the budget', body: 'Taxes bring money in and city services cost money. If the treasury runs dry the city <b>borrows</b>, and too much debt means bankruptcy. The <b>Budget</b> tab shows a live forecast.' },
    { title: 'Keep residents happy', body: 'Happy residents move in and grow the economy. Healthcare and safety matter most to them, and high taxes and unemployment make them angry. Below 20 happiness for 3 quarters, voters <b>recall</b> you.' },
    { title: 'Invest and adapt', body: 'Build <b>Projects</b> for lasting benefits, and react to random <b>events</b>. At the end of your term you get a score out of 1000. Your game saves automatically after every quarter.' },
  ];

  function tutorial(onDone) {
    let step = 0;
    const render = () => {
      const s = TUTORIAL[step];
      const last = step === TUTORIAL.length - 1;
      show({
        eyebrow: `How to play · ${step + 1} of ${TUTORIAL.length}`,
        title: s.title,
        body: `<p>${s.body}</p>`,
        dismissible: false,
        actions: [
          { label: 'Skip', cls: 'btn--ghost', onClick: () => { onDone(); } },
          { label: last ? "Let's go" : 'Next', cls: 'btn--accent', onClick: () => {
            if (last) { onDone(); return; }
            step += 1;
            setTimeout(render, 0);
          } },
        ],
      });
    };
    render();
  }

  // ---------- Toasts ----------
  function toast(message) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.getElementById('toast-root').appendChild(el);
    setTimeout(() => {
      el.classList.add('is-leaving');
      setTimeout(() => el.remove(), 300);
    }, 2600);
  }

  Mayor.ui.modals = { show, close, isOpen, eventChoice, eventNotice, yearEnd, confirm, tutorial, toast };
})();
