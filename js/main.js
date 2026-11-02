// main.js — starts the app and connects buttons to the game engine.
// `game` holds the current state. Every change is followed by a save and a re-render.
(function () {
  const ui = Mayor.ui;
  const $ = (id) => document.getElementById(id);

  let game = null;
  let saveTimer = null;
  let saveWarned = false;

  // ---------- Screens ----------
  function showScreen(name) {
    for (const s of ['title', 'game', 'final']) $(`${s}-screen`).hidden = s !== name;
    window.scrollTo(0, 0);
  }

  // ---------- Saving ----------
  function persist() {
    clearTimeout(saveTimer);
    if (!Mayor.storage.save(game) && !saveWarned) {
      saveWarned = true;
      ui.modals.toast('Saving is unavailable in this browser mode. Progress will be lost on reload.');
    }
  }

  // Slider changes save half a second after the player stops dragging
  function persistSoon() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 500);
  }

  // ---------- Rendering ----------
  function renderAll({ flash = false } = {}) {
    ui.dashboard.renderTopbar(game);
    ui.dashboard.renderKpis(game, { flash });
    ui.dashboard.renderServices(game);
    ui.dashboard.renderAdvisor(game);
    ui.budget.update(game);
    ui.projectsView.render(game);
    ui.news.renderNews(game);
    ui.news.renderLedger(game);
    ui.charts.update(game);
  }

  // ---------- Game actions ----------
  function startNewGame(cityName) {
    game = Mayor.state.createNewGame(cityName);
    persist();
    ui.dashboard.resetAnimations();
    ui.charts.destroyAll();
    $('kpis').innerHTML = '';
    showScreen('game');
    selectTab('overview');
    renderAll();
    if (!Mayor.storage.getPref('tutorialDone', false)) {
      ui.modals.tutorial(() => Mayor.storage.setPref('tutorialDone', true));
    }
  }

  function continueGame(state) {
    game = state;
    ui.dashboard.resetAnimations();
    ui.charts.destroyAll();
    if (game.status !== 'playing') { showFinal(); return; }
    showScreen('game');
    selectTab(Mayor.storage.getPref('tab', 'overview'));
    renderAll();
    if (game.pendingEvent) ui.modals.eventChoice(game, resolveChoice);
  }

  function endQuarter() {
    if (!game || game.status !== 'playing' || game.pendingEvent || ui.modals.isOpen()) return;
    const btn = $('end-turn-btn');
    if (btn.classList.contains('is-busy')) return;
    btn.classList.add('is-busy');
    setTimeout(() => btn.classList.remove('is-busy'), 400);

    const eventsBefore = game.eventsSeen.length;
    game = Mayor.game.endTurn(game);
    persist();
    renderAll({ flash: true });

    if (game.status !== 'playing') {
      ui.modals.show({
        eyebrow: game.status === 'lost' ? 'Game over' : 'Term complete',
        title: game.status === 'lost' ? (game.lossReason === 'bankrupt' ? 'The city is bankrupt' : 'You have been recalled') : 'Ten years in office',
        body: `<p>${game.status === 'lost' ? 'Your time as mayor has ended early.' : 'Your term is over. Let\'s see how history will remember you.'}</p>`,
        dismissible: false,
        actions: [{ label: 'See final report', cls: 'btn--accent', onClick: showFinal }],
      });
      return;
    }

    if (game.turn % 4 === 0) ui.modals.yearEnd(game);
    if (game.eventsSeen.length > eventsBefore) ui.modals.eventNotice(game, game.eventsSeen[game.eventsSeen.length - 1].id);
    if (game.pendingEvent) ui.modals.eventChoice(game, resolveChoice);
  }

  function resolveChoice(index) {
    Mayor.events.resolveChoice(game, index);
    persist();
    renderAll();
  }

  function buildProject(id) {
    const result = Mayor.projects.start(game, id);
    if (!result.ok) { ui.modals.toast(result.reason); return; }
    persist();
    renderAll();
    ui.modals.toast(`Construction started: ${Mayor.projects.get(id).name}`);
  }

  function repay(amount) {
    const paid = Mayor.game.repayDebt(game, amount);
    if (paid > 0) {
      persist();
      renderAll();
      ui.modals.toast(`Repaid ${Mayor.util.money(paid)} of debt`);
    }
  }

  function onPoliciesChanged() {
    ui.dashboard.renderServices(game);
    ui.dashboard.renderAdvisor(game);
    persistSoon();
  }

  function showFinal() {
    showScreen('final');
    ui.finalReport.render(game, {
      onNewGame: () => { goToTitle(); $('city-name').focus(); },
      onMenu: goToTitle,
    });
  }

  // ---------- Title screen ----------
  function goToTitle() {
    if (game && game.status === 'playing') persist();
    refreshContinueCard();
    showScreen('title');
  }

  function refreshContinueCard() {
    const saved = Mayor.storage.load();
    const card = $('continue-card');
    if (!saved) { card.hidden = true; return; }
    if (saved.error) {
      card.hidden = true;
      ui.modals.toast('An old save from an earlier version could not be loaded.');
      return;
    }
    const s = saved.state;
    card.hidden = false;
    $('continue-city').textContent = s.cityName;
    if (s.status === 'playing') {
      $('continue-detail').textContent = `${Mayor.util.dateLabel(s.turn)} · Treasury ${Mayor.util.money(s.treasury)} · Happiness ${s.happiness.toFixed(0)}`;
      $('continue-btn').textContent = 'Continue term';
    } else {
      const r = Mayor.scoring.calculate(s);
      $('continue-detail').textContent = `Term ended · Grade ${r.grade} · ${r.total} points`;
      $('continue-btn').textContent = 'View final report';
    }
  }

  // ---------- Tabs & theme ----------
  function selectTab(name) {
    document.querySelectorAll('.tab').forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on);
    });
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.id === `tab-${name}`));
    Mayor.storage.setPref('tab', name);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    Mayor.storage.setPref('theme', theme);
  }

  // ---------- Wiring ----------
  function init() {
    applyTheme(Mayor.storage.getPref('theme', 'dark'));
    ui.dashboard.drawSkyline();
    ui.budget.init({ onChange: onPoliciesChanged, onRepay: repay });
    ui.projectsView.init({ onBuild: buildProject });

    $('new-game-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('city-name').value.trim() || 'New Haven';
      const saved = Mayor.storage.load();
      if (saved && saved.state && saved.state.status === 'playing') {
        ui.modals.confirm({
          title: 'Start over?',
          body: `This replaces your saved game in <b>${Mayor.util.escapeHtml(saved.state.cityName)}</b> (${Mayor.util.dateLabel(saved.state.turn)}).`,
          confirmLabel: 'Start new game',
          danger: true,
          onConfirm: () => startNewGame(name),
        });
      } else {
        startNewGame(name);
      }
    });

    $('continue-btn').addEventListener('click', () => {
      const saved = Mayor.storage.load();
      if (saved && saved.state) continueGame(saved.state);
    });

    $('end-turn-btn').addEventListener('click', endQuarter);
    $('menu-btn').addEventListener('click', goToTitle);
    $('theme-btn').addEventListener('click', () => {
      applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
      ui.charts.destroyAll();
      if (game) ui.charts.update(game);
    });
    document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => selectTab(t.dataset.tab)));

    // Space ends the quarter (unless typing or using a control)
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'Space' || $('game-screen').hidden) return;
      if (e.target.closest('input, button, textarea, select')) return;
      e.preventDefault();
      endQuarter();
    });

    // Save when the tab is closed mid-drag
    window.addEventListener('pagehide', () => { if (game && game.status === 'playing') persist(); });

    // Resume straight into a game in progress
    const saved = Mayor.storage.load();
    if (saved && saved.state && saved.state.status === 'playing') {
      continueGame(saved.state);
    } else {
      refreshContinueCard();
      showScreen('title');
    }
  }

  init();
})();
